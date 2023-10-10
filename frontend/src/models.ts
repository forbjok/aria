export interface SysConfig {
  max_emote_size: number;
  max_image_size: number;
}

export interface Room {
  id: number;
  name: string;
  content?: Content;
}

export interface Content {
  url: string;
  duration?: number;
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
  you: boolean;
  admin: boolean;

  isDeleted: boolean;
}

export interface Emote {
  id: number;
  name: string;
  url: string;
}
