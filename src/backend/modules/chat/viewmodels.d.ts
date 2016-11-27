interface RoomViewModel {
  name: string;
}

interface ImageViewModel {
  url: string;
  thumbUrl: string;
  originalFilename: string;
}

interface PostViewModel {
  posted: string;
  name: string;
  comment: string;
  ip: string;
  
  image: ImageViewModel;
}
