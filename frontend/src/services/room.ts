import { ref, type Ref } from "vue";
import axios from "axios";

import type { Emote, Room } from "@/models";
import type { LoginResponse } from "./room-auth";

export interface ClaimRequest {
  name: string;
}

export interface ClaimInfo {
  id: number;
  name: string;
  password: string;
  auth: LoginResponse;
}

export class RoomService {
  public id = 0;
  public readonly emotes: Ref<{ [key: string]: Emote }> = ref({});

  constructor(public readonly name: string) {}

  async setup() {
    try {
      const res = await axios.get<Room>(`/api/r/room/${this.name}`);

      this.id = res.data.id;
    } catch {
      this.id = 0;
    }
  }

  exists(): boolean {
    return this.id !== 0;
  }

  async claim(): Promise<ClaimInfo> {
    const req: ClaimRequest = { name: this.name };
    const response = await axios.post<ClaimInfo>(`/api/r/claim`, req);
    const data = await response.data;

    return data;
  }
}
