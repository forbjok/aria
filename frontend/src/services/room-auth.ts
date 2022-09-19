import axios, { type AxiosResponse } from "axios";
import { inject, ref } from "vue";

import type { LocalStorageService } from "@/services/localstorage";
import type { RoomService } from "./room";

export class RoomAuthService {
  public readonly isAuthorized = ref(false);

  private token?: string;
  private localStorageService = inject<LocalStorageService>("storage");

  constructor(private room: RoomService) {}

  private get authKeyName(): string {
    return `room_${this.room.name}_auth`;
  }

  public async setup() {
    await this.loadToken();
  }

  public getToken(): string | undefined {
    return this.token;
  }

  public async setToken(token?: string) {
    this.token = token;
    this.saveToken();
    this.verifyToken();
  }

  public async verifyToken(): Promise<boolean> {
    if (!this.token || !this.room.exists()) {
      return false;
    }

    try {
      await axios.post(`/api/r/i/${this.room.id}/loggedin`, null, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      this.isAuthorized.value = true;
    } catch {
      this.isAuthorized.value = false;
      return false;
    }

    return true;
  }

  public async login(password: string): Promise<boolean> {
    const data = {
      password: password,
    };

    let response: AxiosResponse;

    try {
      response = await axios.post(`/api/r/i/${this.room.id}/login`, data);
    } catch {
      return false;
    }

    const res = await response.data;

    this.token = res.token;
    this.saveToken();

    this.isAuthorized.value = true;
    return true;
  }

  private async loadToken() {
    this.token = this.localStorageService?.get(this.authKeyName);
    await this.verifyToken();
  }

  private saveToken() {
    this.localStorageService?.set(this.authKeyName, this.token);
  }
}
