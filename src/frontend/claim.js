import {inject} from "aurelia-framework";
import {HttpClient} from "aurelia-fetch-client";
import "fetch";

import {LocalRoomSettingsService} from "./services/localroomsettingsservice";

@inject(HttpClient, LocalRoomSettingsService, "RoomName")
export class Claim {
  constructor(http, settings, roomName) {
    this.http = http;
    this.settings = settings;
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
        this.settings.set("token", data.token);
      });
    });
  }

  reload() {
    // Reload page
    window.location.reload();
  }
}
