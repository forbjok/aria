export interface IChatStore {
  getRoom(roomName: string): PromiseLike<RoomInfo>;
  createRoom(roomName: string): PromiseLike<RoomInfo>;
  getPosts(roomName: string, options: any): PromiseLike<Post[]>;
  addPost(roomName: string, post: Post): PromiseLike<Post>;
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
