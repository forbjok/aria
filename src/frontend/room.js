import {inject} from "aurelia-framework";

import {SocketService} from "services/socketservice";
import {RoomAdminService} from "./services/roomadminservice";

import $ from "jquery";
import Cookies from "js-cookie";

@inject(SocketService, RoomAdminService, "RoomName")
export class Room {
  constructor(socketService, adminService, roomName) {
    this.socketService = socketService;
    this.adminService = adminService;
    this.roomName = roomName;

    this.contentUrl = "about:blank";
  }

  bind() {
    let socket = this.socketService.getSocket();
    this.socket = socket;

    let contentEvent = "room:" + this.roomName + ":content";

    socket.on(contentEvent, (content) => {
      this.contentUrl = content.url;
    });

    socket.on("connect", () => {
      socket.emit("room:join", this.roomName);
    });
  }

  activate() {
    let password = Cookies.get("password");
    if (password) {
      return this.adminService.login(password);
    }
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

    // Connect websocket
    this.socket.connect();
  }

  login() {
    let password = window.prompt("What's the password?", "");
    if (password) {
      return this.adminService.login(password)
      .then(() => {
        // Set password cookie
        Cookies.set("password", password, { path: window.location.pathname });
      })
      .catch(() => {
        window.alert("Nope, that's not it.");
      });
    }
  }

  setContentUrl() {
    let contentUrl = window.prompt("Enter new content URL:", "");
    if (contentUrl) {
      return this.adminService.setContentUrl(contentUrl);
    }
  }
}
