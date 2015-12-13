import {inject} from "aurelia-framework";

import {LocalStorageService} from "./localstorageservice";

@inject(LocalStorageService, "RoomName")
export class LocalRoomAuthService
{
  constructor(localStorageService, roomName) {
    this.localStorageService = localStorageService;
    this.roomName = roomName;
    this.authKeyName = `room_${this.roomName}_auth`;
  }

  get() {
    return this.localStorageService.get(this.authKeyName) || {};
  }

  set(value) {
    this.localStorageService.set(this.authKeyName, value);
  }
}
