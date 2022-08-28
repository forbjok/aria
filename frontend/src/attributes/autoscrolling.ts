import { autoinject } from "aurelia-framework";

type AnyFn = (...args: any[]) => any;

function debounce(fn: AnyFn, delay: number): AnyFn {
  let timer: NodeJS.Timeout | undefined;

  return function (...args: any[]) {
    clearTimeout(timer);

    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

@autoinject
export class AutoscrollingCustomAttribute {
  private trackBottom: boolean;
  private observer: MutationObserver;
  private _observerCallback: MutationCallback;
  private _scrollToBottom: AnyFn;
  private _onUserScroll: any;
  private _onWindowResize: any;

  constructor(private element: Element) {
    this.trackBottom = true;

    /* Create event callbacks.
       The reason we don't just use plain class methods is that
       the "this" gets overridden in them so that we can't access
       the class instance. In order to counter that, we create
       them in a method and use scope variables to pass in the
       class instance. */
    this._createEventCallbacks();

    // Initialize observer
    this.observer = new MutationObserver(this._observerCallback);
  }

  _createEventCallbacks() {
    const e = this.element;

    this._scrollToBottom = debounce(() => {
      if (this.trackBottom) {
        e.scrollTop = e.scrollHeight;
      }
    }, 100);

    this._observerCallback = () => {
      this._scrollToBottom();
    };

    this._onUserScroll = (event) => {
      if (e.scrollHeight - e.scrollTop === e.clientHeight) {
        this.trackBottom = true;
      } else {
        this.trackBottom = false;
      }
    };

    this._onWindowResize = () => {
      this._scrollToBottom();
    };
  }

  bind() {
    this.element.addEventListener("wheel", this._onUserScroll);
    this.element.addEventListener("touchmove", this._onUserScroll);
    window.addEventListener("resize", this._onWindowResize);

    this.observer.observe(this.element, {
      childList: true,
      subtree: true,
    });
  }

  unbind() {
    this.element.removeEventListener("wheel", this._onUserScroll);
    this.element.removeEventListener("touchmove", this._onUserScroll);
    window.removeEventListener("resize", this._onWindowResize);
    this.observer.disconnect();
  }

  attached() {
    /* Brute-force fix for the issue of not scrolling all the way
       to the bottom due to images not necessarily being fully loaded
       when this runs. Not an optimal way, but since I haven't been able
       to find any way to detect when all images are fully loaded,
       it will have to do until a better solution is found. */
    setInterval(() => {
      this._scrollToBottom();
    }, 2000);
  }
}
