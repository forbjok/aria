import * as fs from "fs";

import * as express from "express";
import * as multer from "multer";
import * as moment from "moment";
import * as socketio from "socket.io";
import * as xssFilters from "xss-filters";

import { PostViewModel } from "./viewmodels";
import { Emote, IAriaStore, Post } from "../../store";
import { ImageService, ProcessEmoteImageResult, ProcessPostImageResult } from "../../services/image";
import { RequestHandler } from "express";

const noImageFile = <multer.File>{};

const extensionsByMimetype = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
};

interface PreparedEmote {
  name: string;
  url: string;
}

// Get file extension based on mimetype
function getExtensionByMimetype(mimetype) {
  return extensionsByMimetype[mimetype] || "";
}

class ChatRoom {
  private posts: Post[];
  private emotes: PreparedEmote[];

  constructor(
    public readonly name: string,
    private readonly chatServer: ChatServer,
    private readonly io: socketio.Namespace,
    private readonly store: IAriaStore
  ) {}

  public async initialize() {
    // Retrieve recent posts from database
    this.posts = await this.store.getPosts(this.name, { limit: 50 });

    // Retrieve emotes for this room
    const emotes = await this.store.getEmotes(this.name);
    this.emotes = this.chatServer.prepareEmotes(emotes);
  }

  public async join(socket: socketio.Socket) {
    await socket.join(this.name);

    // Send recent posts
    const recentPosts = this.posts.slice(-50);
    socket.emit(
      "oldposts",
      recentPosts.map((p) => this.chatServer.postToViewModel(p))
    );
  }

  public async leave(socket: socketio.Socket) {
    await socket.leave(this.name);
  }

  public async post(post: Post) {
    const addedPost = await this.store.addPost(this.name, post);
    if (!addedPost) return;

    this.posts.push(post);
    this.io.to(this.name).emit("post", this.chatServer.postToViewModel(post));
  }

  public replaceEmotes(s: string): string {
    for (const e of this.emotes) {
      const emoteText = `!${e.name}`;
      s = s.replace(emoteText, `<img class="emote" src="${e.url}" title="${emoteText}">`);
    }

    return s;
  }

  public updateEmote(emote: Emote) {
    const newEmote = this.chatServer.prepareEmote(emote);
    const existingEmote = this.emotes.find((e) => e.name === emote.name);
    if (existingEmote) {
      existingEmote.url = newEmote.url;
    } else {
      this.emotes.push(newEmote);
    }
  }
}

export interface ChatServerOptions {
  baseUrl?: string;
  ioNamespace?: string;
  tempPath: string;
  imagesUrl?: string;
  thumbBackground?: string;
}

export class ChatServer {
  private readonly baseUrl: string = "/chat";
  private readonly ioNamespace: string = "/chat";
  private readonly tempPath: string;
  private readonly imagesUrl: string = "/f";
  private rooms: ChatRoom[];
  private readonly io: socketio.Namespace;

  constructor(
    private readonly app: express.Express,
    private readonly auth: RequestHandler,
    io: socketio.Server,
    private readonly store: IAriaStore,
    private readonly imageService: ImageService,
    options: ChatServerOptions
  ) {
    Object.assign(this, options);

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

    const room = new ChatRoom(name, this, this.io, this.store);
    await room.initialize();

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
    const baseUrl = this.baseUrl;

    // Set up multer storage for uploaded images
    const multerStorage = multer.diskStorage({
      destination: this.tempPath,
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
      try {
        const roomName = req.params.room;

        console.log(`Got post to room ${roomName}.`);

        const room = await this.getRoom(roomName);
        if (!room) {
          console.log(`Room ${roomName} not found.`);
          res.sendStatus(404);
          return;
        }

        const post: Post = {
          id: 0,
          postedAt: moment().utc().toISOString(),
          name: req.body.name ? req.body.name : "Anonymous",
          comment: req.body.comment,
          ip: req.ip,
        };

        if (post.comment) {
          post.comment = xssFilters
            .inHTMLData(post.comment)
            .replace(/((^|\n)>.*)/g, '<span class="quote">$1</span>') // Color quotes
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>') // Clickable links
            .replace(/\n/g, "<br>"); // Convert newlines to HTML line breaks

          post.comment = room.replaceEmotes(post.comment);
        }

        const imageFile = (req as multer.File).file;

        if (imageFile) {
          if (imageFile === noImageFile) {
            res.status(415).send("Unsupported image format");
            return;
          }

          let result: ProcessPostImageResult;
          try {
            result = await this.imageService.processPostImage(imageFile.path);
          } finally {
            fs.unlink(imageFile.path, () => {});
          }

          const { hash, imageExt, thumbExt } = result;

          post.image = {
            filename: imageFile.originalname,
            hash,
            ext: imageExt,
            tnExt: thumbExt,
          };

          await emitPost(roomName, post);
          res.send();
        } else {
          await emitPost(roomName, post);
          res.send();
        }
      } catch (err) {
        res.status(500).send(err.message);
      }
    });

    app.post(`${baseUrl}/:room/emote`, this.auth, upload.single("image"), async (req, res) => {
      try {
        const roomName = req.params.room;

        console.log(`Creating emote for room ${roomName}.`);

        const room = await this.getRoom(roomName);
        if (!room) {
          console.log(`Room ${roomName} not found.`);
          res.sendStatus(404);
          return;
        }

        const imageFile = (req as multer.File).file;

        if (imageFile) {
          if (imageFile === noImageFile) {
            res.status(415).send("Unsupported image format");
            return;
          }

          let result: ProcessEmoteImageResult;
          try {
            result = await this.imageService.processEmoteImage(imageFile.path);
          } finally {
            fs.unlink(imageFile.path, () => {});
          }

          const { hash, ext } = result;

          const emote: Emote = {
            name: req.body.name,
            hash,
            ext,
          };

          // Create emote in database
          this.store.createEmote(roomName, emote);

          // Add or update emote in existing room instance
          room.updateEmote(emote);

          res.send();
        } else {
          res.status(400).send("No image uploaded");
        }
      } catch (err) {
        res.status(500).send(err.message);
      }
    });
  }

  private setupSocket() {
    const io = this.io;

    io.on("connection", (socket) => {
      const ip = socket.handshake.address;
      console.log(`${ip}: Chat connected!`);

      let room: ChatRoom | null = null;

      socket.on("join", async (roomName) => {
        // Already in this room, do nothing.
        if (roomName === room?.name) {
          return;
        }

        // Already in a different room, leave it.
        if (room != null) {
          await room.leave(socket);
        }

        room = await this.getRoom(roomName);

        // Room does not exist, do nothing.
        if (!room) {
          return;
        }

        // Join new room
        console.log(`${ip}: Joining room ${roomName}!`);
        await room.join(socket);
      });

      socket.on("leave", (roomName) => {
        console.log(`${ip}: Leaving chatroom ${roomName}!`);
        room?.leave(socket);
      });

      socket.on("disconnect", () => {
        console.log(`${ip}: Chat disconnected!`);
      });
    });
  }

  // Create a post view-model (for websocket use) from an internal post object
  public postToViewModel(post: Post): PostViewModel {
    const vm: PostViewModel = {
      posted: post.postedAt,
      name: post.name || "Anonymous",
      comment: post.comment || "",

      image: null,
    };

    if (post.image != null) {
      const image = post.image;

      vm.image = {
        url: `${this.imagesUrl}/i/${image.hash}.${image.ext}`,
        thumbUrl: `${this.imagesUrl}/t/${image.hash}.${image.tnExt}`,
        originalFilename: image.filename,
      };
    }

    return vm;
  }

  public prepareEmote(emote: Emote): PreparedEmote {
    return { name: emote.name, url: `${this.imagesUrl}/e/${emote.hash}.${emote.ext}` };
  }

  public prepareEmotes(emotes: Emote[]): PreparedEmote[] {
    return emotes.map((e) => this.prepareEmote(e));
  }
}
