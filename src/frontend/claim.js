import {inject} from "aurelia-framework";
import {HttpClient} from "aurelia-fetch-client";
import "fetch";

import {LocalRoomAuthService} from "./services/localroomauthservice";

@inject(HttpClient, LocalRoomAuthService, "RoomName")
export class Claim {
  constructor(http, auth, roomName) {
    this.http = http;
    this.auth = auth;
    this.roomName = roomName;
  }

  claim() {
    return this.http.fetch(`/r/${this.roomName}/claim`, {
      method: "POST",
      headers: {
        "Accept": "application/json"
      }
    }).then((response) => {
      if (!response.ok) {
        this.claimError = response.statusText;
      }

      response.json().then((data) => {
        this.claimInfo = data;
        this.auth.set(data.token);
      });
    });
  }

  reload() {
    // Reload page
    window.location.reload();
  }
}
