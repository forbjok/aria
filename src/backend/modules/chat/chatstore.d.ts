interface IChatStore {
  getRoom(roomName: string): PromiseLike<RoomInfo>;
  createRoom(roomName: string): PromiseLike<RoomInfo>;
  getPosts(roomName: string, options: any): PromiseLike<Post[]>;
  addPost(roomName: string, post: Post): PromiseLike<Post>;
}

interface RoomInfo {
  name: string;
}

interface Image {
  filename: string;
  thumbnailFilename: string;
  originalFilename: string;
}

interface Post {
  posted: string;
  name: string;
  comment: string;
  ip: string;
  image?: Image;
}
