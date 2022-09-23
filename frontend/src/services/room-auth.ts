import axios from "axios";
import { inject, ref } from "vue";

import type { LocalStorageService } from "@/services/localstorage";
import type { RoomService } from "./room";

export interface LoginResponse {
  access_token: string;
  exp: number;
  refresh_token: string;
}

export class RoomAuthService {
  public readonly isAuthorized = ref(false);

  private auth?: LoginResponse;
  private localStorageService = inject<LocalStorageService>("storage");

  constructor(private room: RoomService) {}

  private get authKeyName(): string {
    return `room_${this.room.name}_auth`;
  }

  public async setup() {
    await this.loadAuth();
  }

  public async getAccessToken(): Promise<string | undefined> {
    if (!(await this.refreshIfNeeded())) {
      return;
    }

    return this.auth?.access_token;
  }

  public async setAuth(auth?: LoginResponse) {
    this.auth = auth;
    this.saveAuth();
    this.verifyToken();
  }

  public async verifyToken(): Promise<boolean> {
    if (!this.auth?.access_token || !this.room.exists()) {
      return false;
    }

    try {
      await axios.post(`/api/r/i/${this.room.id}/loggedin`, null, {
        headers: {
          Authorization: `Bearer ${this.auth?.access_token}`,
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
      level: "room",
      room_id: this.room.id,
      password: password,
    };

    try {
      const response = await axios.post<LoginResponse>(`/api/auth/login`, data);
      this.auth = response.data;
      this.saveAuth();

      this.isAuthorized.value = true;
      return true;
    } catch {
      this.clearAuth();
      return false;
    }
  }

  private async refresh(): Promise<boolean> {
    const data = {
      refresh_token: this.auth?.refresh_token,
    };

    try {
      const response = await axios.post<LoginResponse>(`/api/auth/refresh`, data);
      this.auth = response.data;
      this.saveAuth();

      this.isAuthorized.value = true;
      return true;
    } catch {
      this.clearAuth();
      return false;
    }
  }

  private async refreshIfNeeded(): Promise<boolean> {
    if (!this.auth) {
      return false;
    }

    const now = Date.now() / 1000 - 60;

    // If token is within 1 minute of expiring, refresh
    if (this.auth.exp < now) {
      if (!(await this.refresh())) {
        return false;
      }
    }

    return true;
  }

  private clearAuth() {
    this.auth = undefined;
    this.isAuthorized.value = false;
    this.saveAuth();
  }

  private async loadAuth() {
    this.auth = this.localStorageService?.get<LoginResponse>(this.authKeyName);
    await this.verifyToken();
  }

  private saveAuth() {
    this.localStorageService?.set(this.authKeyName, this.auth);
  }
}
