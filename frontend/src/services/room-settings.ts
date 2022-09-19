import { inject, ref } from "vue";

import type { LocalStorageService } from "@/services/localstorage";
import type { RoomService } from "./room";

interface RoomSettings {
  chatName?: string;
  theme: string;
  isRightSideChat: boolean;
}

const DefaultSettings: RoomSettings = {
  theme: "dark",
  isRightSideChat: false,
};

export class RoomSettingsService {
  public readonly chatName = ref<string | undefined>(undefined);
  public readonly theme = ref("");
  public readonly isRightSideChat = ref(false);

  private localStorageService = inject<LocalStorageService>("storage");

  constructor(private room: RoomService) {
    this.load();
  }

  public load() {
    const settings: RoomSettings = { ...DefaultSettings, ...this.localStorageService?.get(this.getSettingsKeyName()) };
    this.chatName.value = settings.chatName;
    this.theme.value = settings.theme;
    this.isRightSideChat.value = settings.isRightSideChat;
  }

  public save() {
    const settings: RoomSettings = {
      chatName: this.chatName.value,
      theme: this.theme.value,
      isRightSideChat: this.isRightSideChat.value,
    };

    this.localStorageService?.set(this.getSettingsKeyName(), settings);
  }

  private getSettingsKeyName(): string {
    return `room_${this.room.name}`;
  }
}
