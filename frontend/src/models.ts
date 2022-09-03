export interface RoomInfo {
  name: string;
}

export interface Content {
  type: string;
  url: string;
  meta: {
    [key: string]: any;
  };
}
