import {bindable, inject, customElement} from "aurelia-framework";
import {RoomAdminService} from "./services/roomadminservice";

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
    this.adminService.getLoginStatus().then((authorized) => {
      this.authorized = authorized;
      this.initialized = true;
    });
  }

  login() {
    let password = this.password;
    return this.adminService.login(password)
    .then((success) => {
      if (success) {
        this.authorized = true;
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
