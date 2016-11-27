import {autoinject} from "aurelia-framework";

import {State} from "./state";
import fullscreenUtils from "./utils/fullscreen";

import * as io from "socket.io-client";
import * as $ from "jquery";

@autoinject
export class Room {
  private room: HTMLDivElement;
  private chatContainer: HTMLDivElement;
  private contentContainer: HTMLDivElement;
  
  private roomName: string;
  private contentUrl: string;
  private embeddedContent: string[]

  public showRoomControls: boolean;

  constructor(
    state: State)
  {
    this.roomName = state.roomName;
  }

  bind() {
    /* We have to use this window.location.origin + "/namespace" workaround
       because of a bug in socket.io causing the port number to be omitted,
       that's apparently been there for ages and yet still hasn't been fixed
       in a release. Get your shit together, Socket.io people. */
    let socket = io(window.location.origin + "/room", { autoConnect: false });

    socket.on("connect", () => {
      socket.emit("join", this.roomName);
    });

    socket.on("content", (content) => {
      this._setContent(content.url);
    });

    socket.connect();
  }

  attached() {
    let w = $(window);
    let chatContainer = $(this.chatContainer);
    let contentContainer = $(this.contentContainer);

    function resize() {
      let width = w.width();
      let height = w.height();

      if (height > width) {
        // Portrait mode
        contentContainer.css("left", "");
        contentContainer.css("bottom", chatContainer.height() + 4);
      } else {
        // Landscape mode
        contentContainer.css("bottom", "");
        contentContainer.css("left", chatContainer.width() + 2);
      }
    }

    resize();

    w.resize(() => {
      resize();
    });
  }

  _setContent(url) {
    this.contentUrl = url;
    this.embeddedContent = [url];
  }

  reloadContent() {
    // Store original content URL
    let contentUrl = this.contentUrl;

    // Set blank content URL to clear content
    this._setContent(null);

    /* The restoration needs to go in a 1 second timeout, because otherwise it
       doesn't work for some types of content. */
    setTimeout(() => {
      // Restore content URL to reload content
      this._setContent(contentUrl);
    }, 1);
  }

  toggleFullscreen() {
    if (!fullscreenUtils.isInFullscreen()) {
      fullscreenUtils.requestFullscreen(this.room);
    } else {
      fullscreenUtils.exitFullscreen();
    }
  }

  toggleRoomControls() {
    this.showRoomControls = !this.showRoomControls;
  }
}
