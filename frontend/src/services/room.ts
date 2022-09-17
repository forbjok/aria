import { ref, type Ref } from "vue";
import axios from "axios";

import type { Emote } from "@/models";

export interface ClaimInfo {
  name: string;
  password: string;
  token: string;
}

export class RoomService {
  public readonly emotes: Ref<{ [key: string]: Emote }> = ref({});
  constructor(public readonly name: string) {}

  async exists(): Promise<boolean> {
    try {
      await axios.get(`/api/r/${this.name}`);
    } catch {
      return false;
    }

    return true;
  }

  async claim(): Promise<ClaimInfo> {
    const response = await axios.post(`/api/r/${this.name}/claim`);
    const data: ClaimInfo = await response.data;

    return data;
  }
}
