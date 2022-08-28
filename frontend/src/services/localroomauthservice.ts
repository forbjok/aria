import { autoinject } from "aurelia-framework";

import { State } from "../state";
import { LocalStorageService } from "./localstorageservice";

@autoinject
export class LocalRoomAuthService {
  constructor(private localStorageService: LocalStorageService, private state: State) {}

  private get authKeyName(): string {
    return `room_${this.state.roomName}_auth`;
  }

  get(): string {
    return this.localStorageService.get(this.authKeyName) || {};
  }

  set(value: string) {
    this.localStorageService.set(this.authKeyName, value);
  }
}
