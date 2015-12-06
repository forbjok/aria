import {inject} from "aurelia-framework";

import {LocalStorageService} from "./localstorageservice";

@inject(LocalStorageService, "RoomName")
export class LocalRoomSettingsService
{
  constructor(localStorageService, roomName) {
    this.localStorageService = localStorageService;
    this.roomName = roomName;
    this.settingsKeyName = `room_${this.roomName}`;

    this.load();
  }

  load() {
    this.settings = this.localStorageService.get(this.settingsKeyName) || {};
  }

  save() {
    this.localStorageService.set(this.settingsKeyName, this.settings);
  }

  get(name, defaultValue) {
    if (name in this.settings) {
      return this.settings[name];
    }

    return defaultValue;
  }

  set(name, value) {
    this.settings[name] = value;
    this.save();
  }
}
