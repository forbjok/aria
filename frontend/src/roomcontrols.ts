import {autoinject, bindable, customElement} from "aurelia-framework";

import {State} from "./state";
import {RoomAdminService} from "./services/roomadminservice";

import "styles/roomcontrols.less";

@customElement("room-controls")
@autoinject
export class RoomControls {
  private roomName: string;
  private initialized: boolean;
  private authorized: boolean;
  private contentUrl: string;

  public password: string;
  public loginError: string;

  constructor(
    private element: Element,
    private adminService: RoomAdminService,
    state: State,
  ) {
    this.roomName = state.roomName;

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
