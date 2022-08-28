import * as bodyParser from "body-parser";
import * as jwt from "jsonwebtoken";
import * as express from "express";
import { expressjwt } from "express-jwt";
import * as socketio from "socket.io";

import { IAriaStore, RoomInfo } from "../../store";

type AnyFn = (...args: any[]) => any;

interface RoomOptions {
  password?: string;
  contentUrl?: string;
  onContentChange?: AnyFn;
}

class Room {
  public password: string;

  private contentUrl: string;
  private readonly onContentChange: AnyFn;

  constructor(public name: string, options: RoomOptions) {
    Object.assign(this, options);
  }

  public getContentUrl() {
    return this.contentUrl;
  }

  public setContentUrl(url) {
    this.contentUrl = url;
    if (this.onContentChange) this.onContentChange(this.contentUrl);
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
      return await Promise.resolve(rooms[name]);
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
    const io = this.io;
    const store = this.store;

    const room = new Room(name, {
      password: roomInfo.password,
      contentUrl: roomInfo.contentUrl,
      onContentChange: (contentUrl) => {
        store.setContentUrl(name, contentUrl);
        io.to(name).emit("content", { url: contentUrl });
      },
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

    const jwtmw = expressjwt({
      secret: "sekrit",
      algorithms: ["HS256"],
    });

    const jsonBodyParser = bodyParser.json();

    app.get(`${baseUrl}/:room`, async (req, res) => {
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
    });

    app.post(`${baseUrl}/:room/loggedin`, jwtmw, (req, res) => {
      res.send();
    });

    app.post(`${baseUrl}/:room/claim`, async (req, res) => {
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
    });

    app.post(`${baseUrl}/:room/control`, jwtmw, jsonBodyParser, async (req, res) => {
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
          case "set content url":
            room.setContentUrl(action.url);
            break;
        }
      }

      res.send();
    });
  }

  private setupSocket() {
    const io = this.io;

    io.on("connection", (socket) => {
      const ip = socket.handshake.address;
      console.log(`${ip}: Room connected!`);

      const roomsJoined = {};

      socket.on("join", async (roomName) => {
        if (roomName in roomsJoined) {
          return;
        }

        console.log(`${ip}: Joining room ${roomName}!`);

        roomsJoined[roomName] = true;

        const room = await this.getRoom(roomName);

        socket.join(roomName);

        if (room == null) {
          // Room did not exist, return without sending content
          return;
        }

        socket.emit("content", { url: room.getContentUrl() });
      });

      socket.on("leave", (roomName) => {
        console.log(`${ip}: Leaving room ${roomName}!`);
        socket.leave(roomName);
      });

      socket.on("disconnect", () => {
        console.log(`${ip}: Room disconnected!`);
      });
    });
  }
}
