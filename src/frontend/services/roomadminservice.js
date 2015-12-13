import {inject} from "aurelia-framework";
import {HttpClient} from "aurelia-fetch-client";
import "fetch";

import {LocalRoomSettingsService} from "./localroomsettingsservice";

@inject(HttpClient, LocalRoomSettingsService, "RoomName")
export class RoomAdminService {
  constructor(http, settings, roomName) {
    this.http = http;
    this.settings = settings;
    this.roomName = roomName;

    this.token = this.settings.get("token");
  }

  getLoginStatus() {
    return this.http.fetch(`/r/${this.roomName}/loggedin`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.token}`
      }
    }).then((response) => {
      if (!response.ok) {
        return false;
      }

      this.isAdmin = true;
      return this.isAdmin;
    });
  }

  login(password) {
    let data = {
      password: password
    };

    return this.http.fetch(`/r/${this.roomName}/login`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.token}`
      }
    }).then((response) => {
      if (!response.ok) {
        return false;
      }

      return response.json().then((res) => {
        this.token = res.token;
        this.settings.set("token", this.token);

        this.isAdmin = true;
        return this.isAdmin;
      });
    });
  }

  action(action) {
    let data = {
      action: action
    };

    return this.http.fetch(`/r/${this.roomName}/control`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.token}`
      }
    });
  }

  setContentUrl(url) {
    return this.action({
      action: "set content url",
      url: url
    });
  }
}
