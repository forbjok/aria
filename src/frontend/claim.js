import {inject} from "aurelia-framework";
import {HttpClient} from "aurelia-http-client";

import $ from "jquery";
import Cookies from "js-cookie";

@inject(HttpClient, "RoomName")
export class Claim {
  constructor(http, roomName) {
    this.http = http;
    this.roomName = roomName;
  }

  claim() {
    this.http.post(`/r/${this.roomName}/claim`)
    .then(response => {
      this.claimInfo = response.content;

      // Set password cookie
      Cookies.set("password", this.claimInfo.password, { path: window.location.pathname });
    })
    .catch(error => {
      this.claimError = "Error";
    });
  }

  reload() {
    // Reload page
    window.location.reload();
  }
}
