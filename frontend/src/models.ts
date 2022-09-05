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

export interface Image {
  url: string;
  thumbUrl: string;
  originalFilename: string;
}

export interface Post {
  id: number;
  name: string;
  comment: string;
  image?: Image;
  posted: string;
  showFullImage: boolean;
}