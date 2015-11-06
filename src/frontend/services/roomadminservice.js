import {inject} from "aurelia-framework";
import {HttpClient} from "aurelia-http-client";

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

    return this.http.post(`/r/${this.roomName}/control`, data)
    .then(response => {
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

    return this.http.post(`/r/${this.roomName}/control`, data);
  }

  setContentUrl(url) {
    return this.action({
      action: "set content url",
      url: url
    });
  }
}
