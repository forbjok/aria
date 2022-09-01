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
  setContent: (roomName: string, content: Content) => Promise<number>;
}

export interface RoomInfo {
  name: string;
  password: string;
  content: Content;
}

export interface Image {
  path: string;
  thumbnailPath: string;
  filename: string;
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
