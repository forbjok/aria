import * as bodyParser from "body-parser";
import * as jwt from "jsonwebtoken";
import * as express from "express";
import * as socketio from "socket.io";

import { Content, IAriaStore, RoomInfo } from "../../store";
import { PlaybackState } from "./models";
import { RequestHandler } from "express";

interface RoomOptions {
  password?: string;
  content?: Content;
}

class Room {
  public password: string;

  private master?: socketio.Socket;

  private content: Content;
  private playbackStateTimestamp = 0;
  private playbackState: PlaybackState = {
    time: 0,
    rate: 1,
    isPlaying: false,
  };

  constructor(
    public readonly name: string,
    private readonly io: socketio.Namespace,
    private readonly store: IAriaStore,
    options: RoomOptions
  ) {
    Object.assign(this, options);

    setInterval(() => {
      this.broadcastPlaybackState();
    }, 30000);
  }

  public async join(socket: socketio.Socket) {
    await socket.join(this.name);
    socket.emit("joined");
    socket.emit("content", this.content);
    socket.emit("playbackstate", this.getPlaybackState());
  }

  public async leave(socket: socketio.Socket) {
    await socket.leave(this.name);
  }

  public async setContent(content: Content) {
    await this.store.setContent(this.name, content);
    this.content = content;
    this.playbackState.time = 0;
    this.io.to(this.name).emit("content", content);
    this.broadcastPlaybackState();
  }

  public setPlaybackState(ps: PlaybackState, socket: socketio.Socket) {
    // Sender is not master. Ignore.
    if (socket != this.master) return;

    this.playbackStateTimestamp = getTimestamp();
    this.playbackState = ps;
    this.broadcastPlaybackState();
  }

  public setMaster(socket: socketio.Socket) {
    const oldMaster = this.master;
    this.master = socket;

    // Notify the previous master that it is not master anymore.
    if (oldMaster) {
      oldMaster.emit("not-master");
    }
  }

  private getPlaybackState() {
    return {
      ...this.playbackState,
      time: this.playbackState.time + ((getTimestamp() - this.playbackStateTimestamp) * this.playbackState.rate) / 1000,
    };
  }

  private broadcastPlaybackState() {
    if (!this.playbackState) {
      return;
    }

    this.io.to(this.name).emit("playbackstate", this.getPlaybackState());
  }
}

export interface RoomServerOptions {
  baseUrl: string;
  ioNamespace?: string;
}

export class RoomServer {
  private rooms: Room[] = [];
  private readonly io: socketio.Namespace;
  private readonly baseUrl: string = "/r";
  private readonly ioNamespace: string = "/room";

  constructor(
    private readonly app: express.Express,
    private readonly auth: RequestHandler,
    io: socketio.Server,
    private readonly store: IAriaStore,
    options: RoomServerOptions
  ) {
    Object.assign(this, options);

    this.io = io.of(this.ioNamespace);
    this.initialize();
  }

  private async getRoom(name: string): Promise<Room | null> {
    const rooms = this.rooms;

    if (name in rooms) {
      return rooms[name];
    }

    const roomInfo = await this.store.getRoom(name);

    if (roomInfo == null) {
      console.log(`Room ${name} not found.`);
      return null;
    }

    return this.createAndReturnRoom(roomInfo);
  }

  private createAndReturnRoom(roomInfo: RoomInfo): Room {
    const name = roomInfo.name;

    const room = new Room(name, this.io, this.store, {
      password: roomInfo.password,
      content: roomInfo.content,
    });

    this.rooms[name] = room;
    return room;
  }

  private async claimRoom(name): Promise<RoomInfo | null> {
    return await this.store.createRoom(name);
  }

  private initialize() {
    console.log(`Initializing RoomServer on ${this.baseUrl}`);

    this.setupExpress();
    this.setupSocket();
  }

  private async setupExpress() {
    const app = this.app;
    const baseUrl = this.baseUrl;

    const jsonBodyParser = bodyParser.json();

    app.get(`${baseUrl}/:room`, async (req, res) => {
      try {
        const roomName = req.params.room;

        const room = await this.getRoom(roomName);

        if (room == null) {
          // Room was not found
          res.sendStatus(404);
          return;
        }

        // Room was found
        res.send({
          name: roomName,
        });
      } catch (err) {
        console.log(err);
        res.sendStatus(500);
      }
    });

    const createToken = (roomName) => {
      const payload = {
        room: roomName,
      };

      const token = jwt.sign(payload, "sekrit", {
        expiresIn: "7 days",
      });

      return token;
    };

    app.post(`${baseUrl}/:room/login`, jsonBodyParser, async (req, res) => {
      try {
        const roomName = req.params.room;

        const room = await this.getRoom(roomName);
        if (room == null) {
          res.sendStatus(404);
          return;
        }

        const data = req.body;

        if (data.password !== room.password) {
          res.status(403).send("You are not authorized.");
          return;
        }

        res.send({
          token: createToken(roomName),
        });
      } catch (err) {
        console.log(err);
        res.sendStatus(500);
      }
    });

    app.post(`${baseUrl}/:room/loggedin`, this.auth, (req, res) => {
      res.send();
    });

    app.post(`${baseUrl}/:room/claim`, async (req, res) => {
      try {
        const roomName = req.params.room;

        const claimInfo = await this.claimRoom(roomName);
        if (!claimInfo) {
          console.log(`Room ${roomName} could not be claimed.`);

          res.status(403).send("Room has already been claimed.");
          return;
        }

        res.send({
          token: createToken(roomName),
          ...claimInfo,
        });
      } catch (err) {
        console.log(err);
        res.sendStatus(500);
      }
    });

    app.post(`${baseUrl}/:room/control`, this.auth, jsonBodyParser, async (req, res) => {
      try {
        const roomName = req.params.room;

        const room = await this.getRoom(roomName);
        if (room == null) {
          res.sendStatus(404);
          return;
        }

        const data = req.body;

        const action = data.action;
        if (action) {
          switch (action.action) {
            case "set content url": {
              const content = await this.processContentUrl(action.url);
              room.setContent(content);
              break;
            }
          }
        }

        res.send();
      } catch (err) {
        console.log(err);
        res.sendStatus(500);
      }
    });
  }

  private async processContentUrl(url: string): Promise<Content> {
    const youtubeRegex = new RegExp("https?://www.youtube.com/watch\\?v=(.+)");
    const youtubeId = url.match(youtubeRegex);
    if (youtubeId) {
      return {
        type: "youtube",
        url,
        meta: { id: youtubeId[1] },
      };
    }

    const gdriveRegex = new RegExp("https?://drive.google.com/file/d/(.+)/view");
    const gdriveId = url.match(gdriveRegex);
    if (gdriveId) {
      return {
        type: "google_drive",
        url,
        meta: { id: gdriveId[1] },
      };
    }

    return {
      type: "unknown",
      url,
      meta: {},
    };
  }

  private setupSocket() {
    const io = this.io;

    io.on("connection", (socket) => {
      const ip = socket.handshake.address;
      console.log(`${ip}: Connected!`);

      let room: Room | null = null;

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

      socket.on("leave", async (roomName) => {
        console.log(`${ip}: Leaving room ${roomName}!`);
        await socket.leave(roomName);
      });

      socket.on("disconnect", () => {
        console.log(`${ip}: Disconnected!`);
      });

      // Ping/Pong events used by clients to estimate their latency
      // to the server, in order to compensate for it in times.
      socket.on("ping", (time: number) => {
        socket.emit("pong", time);
      });

      socket.on("set-master", () => {
        if (!room) return;

        room.setMaster(socket);
      });

      socket.on("master-playbackstate", (ps: PlaybackState) => {
        if (!room) return;

        room.setPlaybackState(ps, socket);
      });
    });
  }
}

function getTimestamp(): number {
  return new Date().getTime();
}
