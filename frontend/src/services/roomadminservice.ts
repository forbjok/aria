import { autoinject } from "aurelia-framework";
import { HttpClient } from "aurelia-fetch-client";

import { State } from "../state";
import { LocalRoomAuthService } from "./localroomauthservice";

@autoinject
export class RoomAdminService {
  private token: string;
  private isAdmin: boolean;

  constructor(private http: HttpClient, private auth: LocalRoomAuthService, private state: State) {}

  async getLoginStatus(): Promise<boolean> {
    this.token = this.auth.get();

    const response = await this.http.fetch(`/api/r/${this.state.roomName}/loggedin`, {
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
    const data = {
      password: password,
    };

    let response: Response;

    try {
      response = await this.http.fetch(`/api/r/${this.state.roomName}/login`, {
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
      return false;
    }

    const res = await response.json();

    this.token = res.token;
    this.auth.set(this.token);

    this.isAdmin = true;
    return this.isAdmin;
  }

  action(action: any) {
    const data = {
      action: action,
    };

    return this.http.fetch(`/api/r/${this.state.roomName}/control`, {
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
