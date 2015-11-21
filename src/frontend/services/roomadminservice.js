import {inject} from "aurelia-framework";
import {HttpClient} from "aurelia-fetch-client";
import "fetch";

@inject(HttpClient, "RoomName")
export class RoomAdminService {
  constructor(http, roomName) {
    this.http = http;
    this.roomName = roomName;
  }

  login(password) {
    if (this.password) {
      return Promise.resolve(this.isAdmin);
    }

    let data = {
      password: password
    };

    return this.http.fetch(`/r/${this.roomName}/control`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    }).then(response => {
      if (!response.ok) {
        return false;
      }

      this.isAdmin = true;
      this.password = password;
      return this.isAdmin;
    });
  }

  action(action) {
    let data = {
      password: this.password,
      action: action
    };

    return this.http.fetch(`/r/${this.roomName}/control`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
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
