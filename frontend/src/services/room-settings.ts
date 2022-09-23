import { inject, ref } from "vue";

import type { LocalStorageService } from "@/services/localstorage";
import type { RoomService } from "./room";

export interface PostBadges {
  room_admin: boolean;
}

interface RoomSettings {
  chatName?: string;
  theme: string;
  isRightSideChat: boolean;

  postBadges: PostBadges;
}

const DEFAULT_POST_BADGES: PostBadges = {
  room_admin: true,
};

const DEFAULT_SETTINGS: RoomSettings = {
  theme: "dark",
  isRightSideChat: false,
  postBadges: DEFAULT_POST_BADGES,
};

export class RoomSettingsService {
  public readonly chatName = ref<string | undefined>(undefined);
  public readonly theme = ref("");
  public readonly isRightSideChat = ref(false);
  public readonly postBadges = ref({ ...DEFAULT_POST_BADGES });

  private localStorageService = inject<LocalStorageService>("storage");

  constructor(private room: RoomService) {
    this.load();
  }

  public load() {
    const settings: RoomSettings = { ...DEFAULT_SETTINGS, ...this.localStorageService?.get(this.getSettingsKeyName()) };
    this.chatName.value = settings.chatName;
    this.theme.value = settings.theme;
    this.isRightSideChat.value = settings.isRightSideChat;
  }

  public save() {
    const settings: RoomSettings = {
      chatName: this.chatName.value,
      theme: this.theme.value,
      isRightSideChat: this.isRightSideChat.value,
      postBadges: this.postBadges.value,
    };

    this.localStorageService?.set(this.getSettingsKeyName(), settings);
  }

  private getSettingsKeyName(): string {
    return `room_${this.room.name}`;
  }
}
