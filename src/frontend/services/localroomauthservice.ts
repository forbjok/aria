import {autoinject} from "aurelia-framework";

import {State} from "../state";
import {LocalStorageService} from "./localstorageservice";

@autoinject
export class LocalRoomAuthService
{
  private roomName: string;
  private authKeyName: string;

  constructor(
    private localStorageService: LocalStorageService,
    state: State)
  {
    this.roomName = state.roomName;
    this.authKeyName = `room_${this.roomName}_auth`;
  }

  get(): string {
    return this.localStorageService.get(this.authKeyName) || {};
  }

  set(value: string) {
    this.localStorageService.set(this.authKeyName, value);
  }
}
