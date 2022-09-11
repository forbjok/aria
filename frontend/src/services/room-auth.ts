import type { RoomInfo } from "@/models";
import { inject } from "vue";

import type { LocalStorageService } from "@/services/localstorage";

export class RoomAuthService {
  private localStorageService: LocalStorageService | undefined = inject("storage");

  constructor(private room: RoomInfo) {}

  private get authKeyName(): string {
    return `room_${this.room.name}_auth`;
  }

  get(): string | null {
    return this.localStorageService?.get(this.authKeyName) || null;
  }

  set(value: string) {
    this.localStorageService?.set(this.authKeyName, value);
  }
}
