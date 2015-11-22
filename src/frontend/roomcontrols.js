import {bindable, inject, customElement} from "aurelia-framework";
import {RoomAdminService} from "./services/roomadminservice";

import Cookies from "js-cookie";

@customElement("room-controls")
@inject(Element, RoomAdminService, "RoomName")
export class RoomControls {
  constructor(element, adminService, roomName) {
    this.element = element;
    this.adminService = adminService;
    this.roomName = roomName;

    this.initialized = false;
    this.authorized = false;
    this.contentUrl = "";
  }

  bind() {
    let done = () => {
      this.initialized = true;
    };

    let password = Cookies.get("password");
    if (password) {
      this._login(password).then(done);
    } else {
      done();
    }
  }

  _login(password) {
    return this.adminService.login(password)
    .then((success) => {
      if (success) {
        this.authorized = true;
      }

      return success;
    });
  }

  login() {
    let password = this.password;
    this._login(password)
    .then((success) => {
      if (success) {
        // Set password cookie
        Cookies.set("password", password, { path: window.location.pathname });
      } else {
        this.loginError = "Nope, that's not it.";

        setTimeout(() => {
          this.loginError = "";
        }, 2000);
      }

      this.password = "";
      return success;
    });
  }

  setContent() {
    let contentUrl = this.contentUrl;

    if (contentUrl) {
      if (contentUrl.indexOf(":") === -1) {
        // No scheme was present - assume HTTP
        contentUrl = "http://" + contentUrl;
      }

      return this.adminService.setContentUrl(contentUrl)
      .then(() => {
        this.contentUrl = "";
      });
    }
  }
}
