export interface QueryOptions {
  limit?: number;
}

export interface IAriaStore {
  connect: () => Promise<void>;
  migrate: () => Promise<void>;
  getRoom: (roomName: string) => Promise<RoomInfo | null>;
  createRoom: (roomName: string) => Promise<RoomInfo | null>;
  getPosts: (roomName: string, options: QueryOptions) => Promise<Post[]>;
  addPost: (roomName: string, post: Post) => Promise<Post | null>;
  getEmotes: (roomName: string) => Promise<Emote[]>;
  createEmote: (roomName: string, emote: Emote) => Promise<Emote | null>;
  setContent: (roomName: string, content: Content) => Promise<number>;
}

export interface RoomInfo {
  name: string;
  password: string;
  content: Content;
}

export interface Image {
  filename: string;
  hash: string;
  ext: string;
  tnExt: string;
}

export interface Post {
  id: number;
  postedAt: string;
  name?: string;
  comment?: string;
  image?: Image;
  ip: string;
}

export interface Content {
  type: string;
  url: string;
  meta: any;
}

export interface Emote {
  name: string;
  hash: string;
  ext: string;
}
