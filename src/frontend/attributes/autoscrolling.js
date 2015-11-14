import {inject} from "aurelia-framework";

function debounce(fn, delay) {
  let timer = null;

  return function() {
    clearTimeout(timer);

    timer = setTimeout(() => {
      fn.apply(this, arguments);
    }, delay);
  }
}

@inject(Element)
export class AutoscrollingCustomAttribute {
  constructor(element) {
    this.element = element;
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
    let me = this;
    let e = this.element;

    this._scrollToBottom = debounce(() => {
      e.scrollTop = e.scrollHeight;
    }, 100);

    this._observerCallback = debounce(() => {
      if (me.trackBottom) {
        me._scrollToBottom();
      }
    }, 100);

    this._onScroll = debounce((event) => {
      if ((e.scrollHeight - e.scrollTop) === e.clientHeight) {
        me.trackBottom = true;
      } else {
        me.trackBottom = false;
      }
    }, 500);

    let isResizing = false;
    let resizingTrackBottom;

    let onWindowResizeEnding = debounce(() => {
      isResizing = false;

      if (resizingTrackBottom) {
        me._scrollToBottom();
      }
    }, 500);

    this._onWindowResize = (event) => {
      if (!isResizing) {
        isResizing = true;
        resizingTrackBottom = me.trackBottom;
      }

      onWindowResizeEnding();
    };
  }

  bind() {
    this.element.addEventListener("scroll", this._onScroll);
    window.addEventListener("resize", this._onWindowResize);

    this.observer.observe(this.element, {
      childList: true,
      subtree: true
    });
  }

  unbind() {
    this.element.removeEventListener("scroll", this._onScroll);
    window.removeEventListener("resize", this._onWindowResize);
    this.observer.disconnect();
  }

  attached() {
    this._scrollToBottom();
  }
}
