export interface IRoomStore {
  connect(): Promise<void>;
  getRoom(roomName: string): Promise<RoomInfo>;
  claimRoom(roomName: string): Promise<NewRoomInfo>;
  setContentUrl(roomName: string, contentUrl: string): Promise<number>;
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
