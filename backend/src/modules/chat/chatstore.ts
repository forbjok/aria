export interface QueryOptions {
  limit?: number;
}

export interface IChatStore {
  getRoom(roomName: string): Promise<RoomInfo>;
  createRoom(roomName: string): Promise<RoomInfo>;
  getPosts(roomName: string, options: QueryOptions): Promise<Post[]>;
  addPost(roomName: string, post: Post): Promise<Post>;
}

export interface RoomInfo {
  name: string;
}

export interface Image {
  filename: string;
  thumbnailFilename: string;
  originalFilename: string;
}

export interface Post {
  posted: string;
  name: string;
  comment: string;
  ip: string;
  image?: Image;
}
