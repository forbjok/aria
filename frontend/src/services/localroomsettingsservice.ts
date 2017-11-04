import {autoinject} from "aurelia-framework";

import {State} from "../state";
import {LocalStorageService} from "./localstorageservice";

@autoinject
export class LocalRoomSettingsService
{
  private roomName: string;
  private settingsKeyName: string;
  private settings: any[]

  constructor(
    private localStorageService: LocalStorageService,
    state: State)
  {
    this.roomName = state.roomName;
    this.settingsKeyName = `room_${this.roomName}`;

    this.load();
  }

  load() {
    this.settings = this.localStorageService.get(this.settingsKeyName) || {};
  }

  save() {
    this.localStorageService.set(this.settingsKeyName, this.settings);
  }

  get(name: string, defaultValue: any) {
    if (name in this.settings) {
      return this.settings[name];
    }

    return defaultValue;
  }

  set(name: string, value: any) {
    this.settings[name] = value;
    this.save();
  }
}
