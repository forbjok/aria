import axios from "axios";
import { inject } from "vue";

import type { LocalStorageService } from "./localstorage";

interface NewUserResponse {
  user_id: number;
  token: string;
}

export class UserService {
  public userToken?: string;

  private localStorageService = inject<LocalStorageService>("storage");

  public async setup() {
    const userToken = this.localStorageService?.get<string>("user");
    if (userToken) {
      try {
        await axios.post<number>(`/api/user/verify`, null, {
          headers: {
            "X-User": userToken,
          },
        });

        this.userToken = userToken;
      } catch {
        this.userToken = undefined;
      }
    }

    if (!this.userToken) {
      try {
        const res = await axios.post<NewUserResponse>(`/api/user/new`);

        this.userToken = res.data.token;
        this.localStorageService?.set("user", this.userToken);
      } catch {
        this.userToken = undefined;
      }
    }
  }
}
