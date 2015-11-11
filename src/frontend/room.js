import {inject} from "aurelia-framework";

import {RoomAdminService} from "./services/roomadminservice";

import io from "socket.io-client";
import $ from "jquery";
import Cookies from "js-cookie";

@inject(RoomAdminService, "RoomName")
export class Room {
  constructor(adminService, roomName) {
    this.adminService = adminService;
    this.roomName = roomName;

    this.contentUrl = "about:blank";
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
      this.contentUrl = content.url;
    });

    socket.connect();
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
  }

  reloadContent() {
    // Store original content URL
    let contentUrl = this.contentUrl;

    // Set blank content URL to clear content
    this.contentUrl = "";

    // Restore content URL to reload content
    this.contentUrl = contentUrl;
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
      if (contentUrl.indexOf(":") === -1) {
        // No scheme was present - assume HTTP
        contentUrl = "http://" + contentUrl;
      }

      return this.adminService.setContentUrl(contentUrl);
    }
  }
}
