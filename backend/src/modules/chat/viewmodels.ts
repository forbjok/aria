export interface RoomViewModel {
  name: string;
}

export interface ImageViewModel {
  url: string;
  thumbUrl: string;
  originalFilename: string;
}

export interface PostViewModel {
  posted: string;
  name: string;
  comment: string;

  image: ImageViewModel | null;
}
