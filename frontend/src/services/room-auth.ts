import axios, { type AxiosResponse } from "axios";
import { inject, ref } from "vue";

import type { RoomInfo } from "@/models";

import type { LocalStorageService } from "@/services/localstorage";

export class RoomAuthService {
  public readonly isAuthorized = ref(false);

  private token?: string;
  private localStorageService: LocalStorageService | undefined = inject("storage");

  constructor(private room: RoomInfo) {}

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
    if (!this.token) {
      return false;
    }

    try {
      await axios.post(`/api/r/${this.room.name}/loggedin`, null, {
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
      response = await axios.post(`/api/r/${this.room.name}/login`, data);
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
