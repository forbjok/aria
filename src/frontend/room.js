import {inject} from "aurelia-framework";
import io from "socket.io-client";
import $ from "jquery";

@inject("RoomName")
export class Content {
  constructor(roomName) {
    this.roomName = roomName;

    this.contentUrl = "about:blank";
    this.socket = io();
  }

  get chatUrl() {
    return `/chat/${this.roomName}`;
  }

  activate() {
    var socket = this.socket;

    socket.on("content", (url) => {
      console.log("ROOM!", url);
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
      var chatWidth = chatContainer.width();

      contentContainer.css("left", chatWidth + 2);
    }

    resize();

    $(window).resize(() => {
      resize();
    });
  }
}
