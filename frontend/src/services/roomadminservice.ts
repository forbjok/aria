import { autoinject } from "aurelia-framework";
import { HttpClient } from "aurelia-fetch-client";

import { State } from "../state";
import { LocalRoomAuthService } from "./localroomauthservice";

@autoinject
export class RoomAdminService {
  private roomName: string;
  private token: string;
  private isAdmin: boolean;

  constructor(private http: HttpClient, private auth: LocalRoomAuthService, state: State) {
    this.roomName = state.roomName;

    this.token = auth.get();
  }

  async getLoginStatus(): Promise<boolean> {
    let response = await this.http.fetch(`/api/r/${this.roomName}/loggedin`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    this.isAdmin = true;
    return this.isAdmin;
  }

  async login(password: string): Promise<boolean> {
    let data = {
      password: password,
    };

    let response: Response;

    try {
      response = await this.http.fetch(`/api/r/${this.roomName}/login`, {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
      });
    } catch {
      return false;
    }

    if (!response.ok) {
      /* TODO: Figure out why Promise.resolve is required here but not in other cases */
      return Promise.resolve(false);
    }

    let res = await response.json();

    this.token = res.token;
    this.auth.set(this.token);

    this.isAdmin = true;
    return this.isAdmin;
  }

  action(action: any) {
    let data = {
      action: action,
    };

    return this.http.fetch(`/api/r/${this.roomName}/control`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
    });
  }

  setContentUrl(url) {
    return this.action({
      action: "set content url",
      url: url,
    });
  }
}
