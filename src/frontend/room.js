import {inject} from "aurelia-framework";

import socket from "services/sharedsocket";
import {RoomAdminService} from "./services/roomadminservice.js";

import $ from "jquery";
import Cookies from "js-cookie";

@inject(RoomAdminService, "RoomName")
export class Content {
  constructor(adminService, roomName) {
    this.adminService = adminService;
    this.roomName = roomName;

    this.contentUrl = "about:blank";

    socket.on("content", (url) => {
      this.contentUrl = url;
    });

    socket.on("connect", () => {
      socket.emit("join", this.roomName);
    });
  }

  get isAdmin() {
    return this.adminService.isAdmin;
  }

  activate() {
    let password = Cookies.get("password");
    if (password) {
      return this.adminService.login(password);
    }
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
