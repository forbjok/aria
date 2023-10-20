export interface Settings {
  theme: string;
  isRightSideChat: boolean;
}

export interface RoomSettings {
  chatName: string;

  postBadges: {
    room_admin: boolean;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  isRightSideChat: false,
};

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  chatName: "",
  postBadges: {
    room_admin: true,
  },
};
