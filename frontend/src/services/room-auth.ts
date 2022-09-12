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
    this.token = this.loadToken();
    if (!!this.token && (await this.verifyToken(this.token))) {
      this.isAuthorized.value = true;
    } else {
      this.token = undefined;
    }
  }

  public getToken(): string | undefined {
    return this.token;
  }

  public async verifyToken(token: string): Promise<boolean> {
    try {
      await axios.post(`/api/r/${this.room.name}/loggedin`, null, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
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
    this.saveToken(this.token);

    this.isAuthorized.value = true;
    return true;
  }

  private loadToken(): string | undefined {
    return this.localStorageService?.get(this.authKeyName);
  }

  private saveToken(value: string | undefined) {
    this.localStorageService?.set(this.authKeyName, value);
  }
}
