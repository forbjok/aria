import { autoinject, bindable, customElement } from "aurelia-framework";

import { RoomAdminService } from "./services/roomadminservice";

import "styles/roomcontrols.scss";

@customElement("room-controls")
@autoinject
export class RoomControls {
  public initialized: boolean;
  public authorized: boolean;
  public contentUrl: string;

  public password: string;
  public loginError: string;

  constructor(private adminService: RoomAdminService) {
    this.initialized = false;
    this.authorized = false;
    this.contentUrl = "";
  }

  async bind() {
    const authorized = await this.adminService.getLoginStatus();

    this.authorized = authorized;
    this.initialized = true;
  }

  async login() {
    const password = this.password;
    const success = await this.adminService.login(password);

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
  }

  async setContent() {
    let contentUrl = this.contentUrl;

    if (contentUrl) {
      if (contentUrl.indexOf(":") === -1) {
        // No scheme was present - assume HTTP
        contentUrl = "http://" + contentUrl;
      }

      await this.adminService.setContentUrl(contentUrl);
      this.contentUrl = "";
    }
  }
}
