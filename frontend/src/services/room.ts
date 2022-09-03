import axios from "axios";

import type { RoomInfo } from "@/models";

export interface ClaimInfo {
  name: string;
  password: string;
  token: string;
}

export class RoomService {
  constructor(private room: RoomInfo) {}

  async exists(): Promise<boolean> {
    try {
      await axios.get(`/api/r/${this.room.name}`);
    } catch {
      return false;
    }

    return true;
  }

  async claim(): Promise<ClaimInfo> {
    const response = await axios.post(`/api/r/${this.room.name}/claim`);
    const data: ClaimInfo = await response.data;

    return data;
  }
}
