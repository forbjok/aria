import {inject} from "aurelia-framework";
import {HttpClient} from "aurelia-fetch-client";
import "fetch";

import Cookies from "js-cookie";

@inject(HttpClient, "RoomName")
export class Claim {
  constructor(http, roomName) {
    this.http = http;
    this.roomName = roomName;
  }

  claim() {
    return this.http.fetch(`/r/${this.roomName}/claim`, {
      method: "POST",
      headers: {
        "Accept": "application/json"
      }
    }).then(response => {
      if (!response.ok) {
        this.claimError = response.statusText;
      }

      response.json().then((data) => {
        this.claimInfo = data;

        // Set password cookie
        Cookies.set("password", this.claimInfo.password, { path: window.location.pathname });
      });
    });
  }

  reload() {
    // Reload page
    window.location.reload();
  }
}
