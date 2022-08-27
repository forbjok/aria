import * as bodyParser from "body-parser";
import * as jwt from "jsonwebtoken";
import * as express from "express";
import { expressjwt } from "express-jwt";
import * as socketio from "socket.io";

import { IRoomStore, NewRoomInfo, RoomInfo } from "./roomstore";
import { IServer } from "../module";

class Room {
  contentUrl: string;
  onContentChange: Function;
  password: string;

  constructor(public name:string, options:any) {
    this.name = name;

    Object.assign(this, {
      onContentChange: () => {}
    }, options);
  }

  getContentUrl() {
    return this.contentUrl;
  }

  setContentUrl(url) {
    this.contentUrl = url;
    this.onContentChange(this.contentUrl);
  }
}

export interface RoomServerOptions {
  baseUrl: string;
  ioNamespace: string;
}

export class RoomServer implements IServer {
  rooms: Room[];
  io: socketio.Namespace;
  baseUrl: string;
  ioNamespace: string;

  constructor(public app: express.Express, io: socketio.Server, public store: IRoomStore, options: RoomServerOptions) {
    this.app = app;
    this.store = store;

    Object.assign(this, {
      baseUrl: "/r",
      ioNamespace: "/room",
    }, options);

    this.rooms = [];

    this.io = io.of(this.ioNamespace);
    this._initialize();
  }

  async _getRoom(name: string): Promise<Room> {
    let rooms = this.rooms;

    if (name in rooms) {
      return Promise.resolve(rooms[name]);
    }

    let roomInfo = await this.store.getRoom(name);

    if (!roomInfo) {
      console.log(`Room ${name} not found.`);
      return;
    }

    return this._createAndReturnRoom(roomInfo);
  }

  _createAndReturnRoom(roomInfo: RoomInfo): Room {
    let name = roomInfo.name;
    let io = this.io;
    let store = this.store;

    let room = new Room(name, {
      password: roomInfo.password,
      contentUrl: roomInfo.contentUrl,
      onContentChange: (contentUrl) => {
        store.setContentUrl(name, contentUrl);
        io.to(name).emit("content", { url: contentUrl });
      }
    });

    this.rooms[name] = room;
    return room;
  }

  async _claimRoom(name): Promise<NewRoomInfo> {
    return await this.store.claimRoom(name);
  }

  _initialize() {
    console.log(`Initializing RoomServer on ${this.baseUrl}`);

    this._setupExpress();
    this._setupSocket();
  }

  async _setupExpress() {
    let app = this.app;
    let baseUrl = this.baseUrl;

    let jwtmw = expressjwt({
      secret: "sekrit",
      algorithms: ["HS256"],
    });

    let jsonBodyParser = bodyParser.json();

    app.get(`${baseUrl}/:room`, async (req, res) => {
      let roomName = req.params.room;

      let room = await this._getRoom(roomName);

      if (!room) {
        // Room was not found
        res.send(404);
        return;
      }

      // Room was found
      res.send({
        name: roomName,
      });
    });

    let createToken = (roomName) => {
      let payload = {
        room: roomName
      };

      let token = jwt.sign(payload, "sekrit", {
        expiresIn: "7 days"
      });

      return token;
    };

    app.post(`${baseUrl}/:room/login`, jsonBodyParser, async (req, res) => {
      let roomName = req.params.room;

      let room = await this._getRoom(roomName);

      let data = req.body;

      if (data.password !== room.password) {
        res.status(403).send("You are not authorized.");
        return;
      }

      res.send({
        token: createToken(roomName)
      });
    });

    app.post(`${baseUrl}/:room/loggedin`, jwtmw, (req, res) => {
      res.send();
    });

    app.post(`${baseUrl}/:room/claim`, async (req, res) => {
      let roomName = req.params.room;

      let claimInfo = await this._claimRoom(roomName);
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

    app.post(`${baseUrl}/:room/control`,
      jwtmw,
      jsonBodyParser,
      async (req, res) => {
      let roomName = req.params.room;

      let room = await this._getRoom(roomName);

      let data = req.body;

      let action = data.action;
      if (action) {
        switch(action.action) {
          case "set content url":
          room.setContentUrl(action.url);
          break;
        }
      }

      res.send();
    });
  }

  _setupSocket() {
    let io = this.io;

    io.on("connection", (socket) => {
      let ip = socket.handshake.address;
      console.log(`${ip}: Room connected!`);

      let roomsJoined = {};

      socket.on("join", async (roomName) => {
        if (roomName in roomsJoined) {
          return;
        }

        console.log(`${ip}: Joining room ${roomName}!`);

        roomsJoined[roomName] = true;

        let room = await this._getRoom(roomName);

        socket.join(roomName);

        if (!room) {
          // Room did not exist, return without sending content
          return;
        }

        let contentUrl = room.getContentUrl();

        socket.emit("content", { url: contentUrl });
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

export function create(app: express.Express, io: socketio.Server, store: IRoomStore, options: RoomServerOptions): RoomServer {
  return new RoomServer(app, io, store, options);
}