import {inject} from "aurelia-framework";

import fullscreenUtils from "./utils/fullscreen";

import io from "socket.io-client";
import $ from "jquery";

@inject("RoomName")
export class Room {
  constructor(roomName) {
    this.roomName = roomName;
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
    this._setContent(this.contentUrl);
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
