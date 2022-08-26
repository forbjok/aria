export interface IRoomStore {
    getRoom(roomName: string): PromiseLike<RoomInfo>;
    claimRoom(roomName: string): PromiseLike<NewRoomInfo>;
    setContentUrl(roomName: string, contentUrl: string): PromiseLike<number>;
}

export interface NewRoomInfo {
  name: string;
  password: string;
}

export interface RoomInfo {
  name: string;
  password: string;
  contentUrl: string;
  claimed: Date;
  expires: Date;
}
