import axios from "axios";

import type { RoomAuthService } from "@/services/room-auth";
import type { RoomService } from "./room";

export class RoomAdminService {
  constructor(private room: RoomService, private auth: RoomAuthService) {}

  async action(action: any) {
    if (!this.auth.isAuthorized.value) {
      console.log("User not authorized to perform action.");
      return;
    }

    const accessToken = await this.auth?.getAccessToken();
    if (!accessToken) {
      return;
    }

    const data = {
      action: action,
    };

    return await axios.post(`/api/r/i/${this.room.id}/control`, data, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  async setContentUrl(url: string) {
    return await this.action({
      action: "set content url",
      url: url,
    });
  }
}
