import {inject} from "aurelia-framework";
import {HttpClient} from "aurelia-http-client";

import $ from "jquery";
import "jquery-cookie";

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
      $.cookie("password", this.claimInfo.password, { path: window.location.pathname });
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
