import {inject} from "aurelia-framework";
import {HttpClient} from "aurelia-fetch-client";
import "fetch";

import {LocalRoomAuthService} from "./localroomauthservice";

@inject(HttpClient, LocalRoomAuthService, "RoomName")
export class RoomAdminService {
  constructor(http, auth, roomName) {
    this.http = http;
    this.auth = auth;
    this.roomName = roomName;

    this.token = auth.get();
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
        this.auth.set(this.token);

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
