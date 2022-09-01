import type { RoomInfo } from "@/models";
import { inject } from "vue";

import type { LocalStorageService } from "@/services/localstorageservice";

export class LocalRoomSettingsService {
  private localStorageService: LocalStorageService | undefined = inject("storage");

  private settings: { [key: string]: any[] } = {};

  constructor(private room: RoomInfo) {}

  private getSettingsKeyName(): string {
    return `room_${this.room.name}`;
  }

  load() {
    this.settings = this.localStorageService?.get(this.getSettingsKeyName()) || {};
  }

  save() {
    this.localStorageService?.set(this.getSettingsKeyName(), this.settings);
  }

  get(name: string, defaultValue: any): any {
    if (name in this.settings) {
      return this.settings[name];
    }

    return defaultValue;
  }

  set(name: string, value: any): void {
    this.settings[name] = value;
    this.save();
  }
}
