import { nanoid } from "nanoid";
import { inject } from "vue";

import type { LocalStorageService } from "./localstorage";

interface UserSettings {
  password: string;
}

export class UserService {
  public readonly password: string;

  private localStorageService = inject<LocalStorageService>("storage");

  constructor() {
    let user_settings = this.localStorageService?.get<UserSettings>("aria_user");
    if (!user_settings) {
      const password = nanoid(6);

      user_settings = {
        password,
      };

      this.localStorageService?.set("aria_user", user_settings);
    }

    this.password = user_settings.password;
  }
}
