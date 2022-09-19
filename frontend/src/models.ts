export interface Room {
  id: number;
  name: string;
  content?: Content;
}

export interface Content {
  type: string;
  url: string;
  meta: {
    [key: string]: any;
  };
}

export interface Image {
  filename: string;
  url: string;
  tn_url: string;
}

export interface Post {
  id: number;
  name: string;
  comment: string;
  image?: Image;
  posted: string;
  showFullImage: boolean;
  isDeleted: boolean;
}

export interface Emote {
  id: number;
  name: string;
  url: string;
}
