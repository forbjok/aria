import type { RoomInfo } from "@/models";
import { inject } from "vue";

import type { LocalStorageService } from "@/services/localstorageservice";

export class LocalRoomAuthService {
  private localStorageService: LocalStorageService | undefined = inject("storage");

  constructor(private room: RoomInfo) {}

  private get authKeyName(): string {
    return `room_${this.room.name}_auth`;
  }

  get(): string {
    return this.localStorageService?.get(this.authKeyName) || {};
  }

  set(value: string) {
    this.localStorageService?.set(this.authKeyName, value);
  }
}
