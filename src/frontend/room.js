import {inject} from "aurelia-framework";
import $ from "jquery";

import socket from "services/sharedsocket";

@inject("RoomName")
export class Content {
  constructor(roomName) {
    this.roomName = roomName;

    this.contentUrl = "about:blank";

    socket.on("content", (url) => {
      this.contentUrl = url;
    });

    socket.on("connect", () => {
      socket.emit("join", this.roomName);
    });
  }

  attached() {
    let w = $(window);
    let chatContainer = $("#chatContainer");
    let contentContainer = $("#contentContainer");

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

    // Connect websocket
    socket.connect();
  }
}
