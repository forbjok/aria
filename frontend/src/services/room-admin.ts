import axios, { type AxiosResponse } from "axios";

import type { RoomAuthService } from "@/services/room-auth";
import type { RoomInfo } from "@/models";

export class RoomAdminService {
  private token?: string | null;
  private isAdmin = false;

  constructor(private room: RoomInfo, private auth: RoomAuthService) {}

  async getLoginStatus(): Promise<boolean> {
    this.token = this.auth.get();
    if (!this.token) {
      return false;
    }

    try {
      await axios.post(`/api/r/${this.room.name}/loggedin`, null, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
    } catch {
      return false;
    }

    this.isAdmin = true;
    return this.isAdmin;
  }

  async login(password: string): Promise<boolean> {
    const data = {
      password: password,
    };

    let response: AxiosResponse;

    try {
      response = await axios.post(`/api/r/${this.room.name}/login`, data);
    } catch {
      return false;
    }

    const res = await response.data;

    this.token = res.token;
    this.auth.set(this.token || "");

    this.isAdmin = true;
    return this.isAdmin;
  }

  action(action: any) {
    const data = {
      action: action,
    };

    return axios.post(`/api/r/${this.room.name}/control`, data, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
  }

  setContentUrl(url: string) {
    return this.action({
      action: "set content url",
      url: url,
    });
  }
}
