import {inject} from "aurelia-framework";
import $ from "jquery";

import socket from "services/sharedsocket";

@inject("RoomName")
export class Content {
  constructor(roomName) {
    this.roomName = roomName;

    this.contentUrl = "about:blank";

    socket.on("content", (url) => {
      console.log("New content URL received", url);
      this.contentUrl = url;
    });

    socket.on("connect", () => {
      socket.emit("join", this.roomName);
    });
  }

  attached() {
    var chatContainer = $("#chatContainer");
    var contentContainer = $("#contentContainer");

    function resize() {
      if(screen.height > screen.width) {
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

    $(window).resize(() => {
      resize();
    });

    // Connect websocket
    socket.connect();
  }
}
