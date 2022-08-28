import * as path from "path";
import * as express from "express";
import * as multer from "multer";
import * as easyimg from "easyimage";
import * as moment from "moment";
import * as socketio from "socket.io";

import { PostViewModel } from "./viewmodels";
import { IAriaStore, Post, RoomInfo } from "../../store";

type AnyFn = (...args: any[]) => any;

const noImageFile = <multer.File>{};

const extensionsByMimetype = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
};

// Get file extension based on mimetype
function getExtensionByMimetype(mimetype) {
  return extensionsByMimetype[mimetype] || "";
}

function stripExtension(filename) {
  return path.basename(filename, path.extname(filename));
}

export interface ChatRoomOptions {
  posts: Post[];
  onPost?: AnyFn;
}

class ChatRoom {
  private readonly posts: Post[] = [];
  private readonly onPost?: AnyFn;

  constructor(public name: string, options: ChatRoomOptions) {
    Object.assign(this, options);
  }

  public getRecentPosts(): Post[] {
    return this.posts.slice(-50);
  }

  public post(post: Post) {
    this.posts.push(post);
    if (this.onPost) this.onPost(post);
  }
}

export interface ChatServerOptions {
  baseUrl?: string;
  ioNamespace?: string;
  imagesPath: string;
  thumbSize?: number;
  thumbBackground?: string;
}

export class ChatServer {
  private readonly baseUrl: string = "/chat";
  private readonly ioNamespace: string = "/chat";
  private readonly imagesPath: string;
  private readonly thumbSize: number = 100;
  private readonly thumbBackground: string = "#D6DAF0";
  private readonly imagesUrl: string;
  private rooms: ChatRoom[];
  private readonly io: socketio.Namespace;

  constructor(
    private readonly app: express.Express,
    io: socketio.Server,
    private readonly store: IAriaStore,
    options: ChatServerOptions
  ) {
    Object.assign(this, options);

    this.imagesUrl = this.baseUrl + "/images";
    this.rooms = [];

    this.io = io.of(this.ioNamespace);
    this.initialize();
  }

  private async getRoom(name: string): Promise<ChatRoom | null> {
    const rooms = this.rooms;

    if (name in rooms) {
      return rooms[name];
    }

    const roomInfo = await this.store.getRoom(name);

    if (roomInfo == null) {
      console.log(`Chatroom ${name} not found.`);
      return null;
    }

    return await this.createAndReturnRoom(roomInfo);
  }

  private async createAndReturnRoom(roomInfo: RoomInfo): Promise<ChatRoom> {
    const name = roomInfo.name;
    const io = this.io;
    const store = this.store;

    // Retrieve recent posts from database
    const posts = await store.getPosts(name, { limit: 50 });
    const room = new ChatRoom(name, {
      posts: posts,
      onPost: (post) => {
        store.addPost(name, post);
        io.to(name).emit("post", this.postToViewModel(post));
      },
    });

    this.rooms[name] = room;
    return room;
  }

  private initialize() {
    console.log(`Initializing ChatServer on ${this.baseUrl}`);

    this.setupExpress();
    this.setupSocket();
  }

  private async setupExpress() {
    const app = this.app;
    const imagesPath = this.imagesPath;
    const baseUrl = this.baseUrl;
    const thumbSize = this.thumbSize;
    const thumbBackground = this.thumbBackground;

    // Serve images
    app.use(this.imagesUrl, express.static(this.imagesPath, { maxAge: "1 hour" }));

    // Set up multer storage for uploaded images
    const multerStorage = multer.diskStorage({
      destination: imagesPath,
      filename: (_req, file, cb) => {
        const extension = getExtensionByMimetype(file.mimetype);
        const filename = moment().utc().valueOf().toString() + extension;

        cb(null, filename);
      },
    });

    // Set up multer uploader
    const upload = multer({
      storage: multerStorage,
      fileFilter: (req, file, cb) => {
        if (file.mimetype in extensionsByMimetype) {
          cb(null, true);
          return;
        }

        console.log(`File rejected: "${file.originalname}". Unsupported mimetype "${file.mimetype}".`);
        req.file = noImageFile;
        cb(null, false);
      },
    });

    const emitPost = async (roomName, post) => {
      const room = await this.getRoom(roomName);
      if (room == null) return;

      room.post(post);
    };

    app.post(`${baseUrl}/:room/post`, upload.single("image"), async (req, res) => {
      const roomName = req.params.room;

      console.log(`Got post to room ${roomName}.`);

      const post: Post = {
        postedAt: moment().utc().toISOString(),
        name: req.body.name ? req.body.name : "Anonymous",
        comment: req.body.comment,
        ip: req.ip,
      };

      const imageFile = (req as multer.File).file;

      if (imageFile) {
        if (imageFile === noImageFile) {
          res.status(415).send("Unsupported image format");
          return;
        }

        const filename = imageFile.filename;
        const thumbFilename = "thumb-" + stripExtension(filename) + ".jpg";

        // Generate thumbnail
        await easyimg.resize({
          src: imageFile.path,
          dst: path.join(imagesPath, thumbFilename),
          width: thumbSize,
          height: thumbSize,
          quality: 80,
          background: thumbBackground,
        });

        post.image = {
          path: filename,
          thumbnailPath: thumbFilename,
          filename: imageFile.originalname,
        };

        await emitPost(roomName, post);
        res.send();
      } else {
        await emitPost(roomName, post);
        res.send();
      }
    });
  }

  private setupSocket() {
    const io = this.io;

    io.on("connection", (socket) => {
      const ip = socket.handshake.address;
      console.log(`${ip}: Chat connected!`);

      const roomsJoined = {};

      socket.on("join", async (roomName) => {
        if (roomName in roomsJoined) {
          return;
        }

        console.log(`${ip}: Joining chatroom ${roomName}!`);

        roomsJoined[roomName] = true;
        const room = await this.getRoom(roomName);

        socket.join(roomName);

        if (room == null) {
          // Room did not exist, return without sending content
          return;
        }

        console.log(`${ip}: Sending recent posts.`);
        const recentPosts = room.getRecentPosts();

        for (const post of recentPosts) {
          socket.emit("post", this.postToViewModel(post));
        }
      });

      socket.on("leave", (roomName) => {
        console.log(`${ip}: Leaving chatroom ${roomName}!`);
        socket.leave(roomName);
      });

      socket.on("disconnect", () => {
        console.log(`${ip}: Chat disconnected!`);
      });
    });
  }

  // Create a post view-model (for websocket use) from an internal post object
  private postToViewModel(post: Post): PostViewModel {
    const vm: PostViewModel = {
      posted: post.postedAt,
      name: post.name || "Anonymous",
      comment: post.comment || "",

      image: null,
    };

    if (post.image != null) {
      const image = post.image;
      const imagesUrl = this.imagesUrl;

      vm.image = {
        url: imagesUrl + "/" + image.path,
        thumbUrl: imagesUrl + "/" + image.thumbnailPath,
        originalFilename: image.filename,
      };
    }

    return vm;
  }
}
