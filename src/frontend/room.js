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
    var chatFrame = $("#chatFrame");
    var contentContainer = $("#contentContainer");

    function resize() {
      var chatFrameWidth = chatFrame.width();

      contentContainer.css("left", chatFrameWidth + 2);
    }

    resize();

    $(window).resize(() => {
      resize();
    });
  }
}
