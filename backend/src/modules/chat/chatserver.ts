import * as path from "path";
import * as express from "express";
import * as multer from "multer";
import * as easyimg from "easyimage";
import * as moment from "moment";
import * as socketio from "socket.io";

import { IChatStore, Post, RoomInfo } from "./chatstore";
import { PostViewModel } from "./viewmodels";
import { IServer } from "../module";

let noImageFile = <multer.File>{};

let extensionsByMimetype = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif"
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
  onPost: Function;
}

class ChatRoom {
  posts: Post[];
  onPost: Function;

  constructor(public name: string, options: ChatRoomOptions) {
    Object.assign(this, {
      onPost: () => {}
    }, options);

    if (!this.posts) {
      this.posts = [];
    }
  }

  getRecentPosts(): Post[] {
    return this.posts.slice(-50);
  }

  post(post: Post) {
    this.posts.push(post);
    this.onPost(post);
  }
}

export interface ChatServerOptions {
  baseUrl: string;
  ioNamespace: string;
  imagesPath: string;
  thumbSize: number;
  thumbBackground: string;
}

class ChatServer implements IServer {
  baseUrl: string;
  ioNamespace: string;
  imagesPath: string;
  thumbSize: number;
  thumbBackground: string;
  imagesUrl: string;
  rooms: ChatRoom[];
  io: socketio.Namespace;

  constructor(public app: express.Express, io: socketio.Server, public store: IChatStore, options: ChatServerOptions) {
    Object.assign(this, {
      baseUrl: "/chat",
      ioNamespace: "/chat",
      imagesPath: path.join(__dirname, "images"),
      thumbSize: 100,
      thumbBackground: "#D6DAF0",
    }, options);

    this.imagesUrl = this.baseUrl + "/images";
    this.rooms = [];

    this.io = io.of(this.ioNamespace);
    this._initialize();
  }

  // Create a post view-model (for websocket use) from an internal post object
  _postToViewModel(post: Post): PostViewModel {
    let vm: PostViewModel = {
      posted: post.posted,
      name: post.name,
      comment: post.comment,
      ip: null,

      image: null,
    };

    if (post.image) {
      let image = post.image;
      let imagesUrl = this.imagesUrl;

      vm.image = {
        url: imagesUrl + "/" + image.filename,
        thumbUrl: imagesUrl + "/" + image.thumbnailFilename,
        originalFilename: image.originalFilename
      };
    }

    return vm;
  }

  async _getRoom(name: string): Promise<ChatRoom> {
    let rooms = this.rooms;

    if (name in rooms) {
      return rooms[name];
    }

    let roomInfo = await this.store.getRoom(name);

    if (!roomInfo) {
      console.log(`Chatroom ${name} not found. Creating it.`);

      let room = await this.store.createRoom(name);

      return await this._createAndReturnRoom(room);
    }

    return await this._createAndReturnRoom(roomInfo);
}

  async _createAndReturnRoom(roomInfo: RoomInfo): Promise<ChatRoom> {
    let name = roomInfo.name;
    let io = this.io;
    let store = this.store;

    // Retrieve recent posts from database
    let posts = await store.getPosts(name, { limit: 50 });
    let room = new ChatRoom(name, {
      posts: posts,
      onPost: (post) => {
        store.addPost(name, post);
        io.to(name).emit("post", this._postToViewModel(post));
      }
    });

    this.rooms[name] = room;
    return room;
  }

  _initialize() {
    console.log(`Initializing ChatServer on ${this.baseUrl}`);

    this._setupExpress();
    this._setupSocket();
  }

  async _setupExpress() {
    let app = this.app;
    let imagesPath = this.imagesPath;
    let baseUrl = this.baseUrl;
    let thumbSize = this.thumbSize;
    let thumbBackground = this.thumbBackground;

    // Serve images
    app.use(this.imagesUrl, express.static(this.imagesPath, { maxAge: "1 hour" }));

    // Set up multer storage for uploaded images
    let multerStorage = multer.diskStorage({
      destination: imagesPath,
      filename: (req, file, cb) => {
        let extension = getExtensionByMimetype(file.mimetype);
        let filename = moment().utc().valueOf().toString() + extension;

        cb(null, filename);
      }
    });

    // Set up multer uploader
    let upload = multer({
      storage: multerStorage,
      fileFilter: (req, file, cb) => {
        if (file.mimetype in extensionsByMimetype) {
          cb(null, true);
          return;
        }

        console.log(`File rejected: "${file.originalname}". Unsupported mimetype "${file.mimetype}".`);
        req.file = noImageFile;
        cb(null, false);
      }
    });

    let emitPost = async (roomName, post) => {
      let room = await this._getRoom(roomName);
      room.post(post);
    }

    app.post(`${baseUrl}/:room/post`, upload.single("image"), async (req, res) => {
      let roomName = req.params.room;

      console.log(`Got post to room ${roomName}.`);

      let post: Post = {
        posted: moment().utc().toISOString(),
        name: req.body.name ? req.body.name : "Anonymous",
        comment: req.body.comment,
        ip: req.ip,
      };

      let imageFile = (req as multer.File).file;

      if (imageFile) {
        if (imageFile === noImageFile) {
          res.status(415).send("Unsupported image format");
          return;
        }

        let filename = imageFile.filename;
        let thumbFilename = "thumb-" + stripExtension(filename) + ".jpg";

        let file = await easyimg.resize({
          src: imageFile.path,
          dst: path.join(imagesPath, thumbFilename),
          width: thumbSize,
          height: thumbSize,
          quality: 80,
          background: thumbBackground
        });

        post.image = {
          filename: filename,
          thumbnailFilename: thumbFilename,
          originalFilename: imageFile.originalname
        }

        await emitPost(roomName, post);
        res.send();
      } else {
        await emitPost(roomName, post);
        res.send();
      }
    });
  }

  _setupSocket() {
    let io = this.io;

    io.on("connection", (socket) => {
      let ip = socket.handshake.address;
      console.log(`${ip}: Chat connected!`);

      let roomsJoined = {};

      socket.on("join", async (roomName) => {
        if (roomName in roomsJoined) {
          return;
        }

        console.log(`${ip}: Joining chatroom ${roomName}!`);

        roomsJoined[roomName] = true;
        let room = await this._getRoom(roomName);

        socket.join(roomName);

        if (!room) {
          // Room did not exist, return without sending content
          return;
        }

        console.log(`${ip}: Sending recent posts.`);
        let recentPosts = room.getRecentPosts();

        for (let post of recentPosts) {
          socket.emit("post", this._postToViewModel(post));
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
}

export function create(app: express.Express, io: socketio.Server, store: IChatStore, options: ChatServerOptions): ChatServer {
  return new ChatServer(app, io, store, options);
}
