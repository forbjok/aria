import {autoinject} from "aurelia-framework";
import {HttpClient} from "aurelia-fetch-client";
import "fetch";

import {State} from "../state";
import {LocalRoomAuthService} from "./localroomauthservice";

@autoinject
export class RoomAdminService {
  private roomName: string;
  private token: string;
  private isAdmin: boolean;

  constructor(
    private http: HttpClient,
    private auth: LocalRoomAuthService,
    state: State)
  {
    this.roomName = state.roomName;

    this.token = auth.get();
  }

  getLoginStatus(): PromiseLike<boolean> {
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

  login(password: string): PromiseLike<boolean> {
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
        /* TODO: Figure out why Promise.resolve is required here but not in other cases */
        return Promise.resolve(false);
      }

      return response.json().then((res) => {
        this.token = res.token;
        this.auth.set(this.token);

        this.isAdmin = true;
        return this.isAdmin;
      });
    });
  }

  action(action: any) {
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
