import axios from "axios";

import type { RoomAuthService } from "@/services/room-auth";
import type { RoomInfo } from "@/models";

export class RoomAdminService {
  constructor(private room: RoomInfo, private auth: RoomAuthService) {}

  action(action: any) {
    if (!this.auth.isAuthorized.value) {
      console.log("User not authorized to perform action.");
      return;
    }

    const data = {
      action: action,
    };

    return axios.post(`/api/r/${this.room.name}/control`, data, {
      headers: {
        Authorization: `Bearer ${this.auth.getToken()}`,
      },
    });
  }

  setContentUrl(url: string) {
    return this.action({
      action: "set content url",
      url: url,
    });
  }
}
