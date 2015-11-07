"use strict";

var bodyParser = require("body-parser");

class Room {
  constructor(name, options) {
    this.name = name;

    Object.assign(this, options);
  }

  getContentUrl() {
    return this.contentUrl;
  }

  setContentUrl(url) {
    this.contentUrl = url;
    this.contentChanged(this.contentUrl);
  }
}

class RoomServer {
  constructor(app, io, store, options) {
    this.app = app;
    this.io = io;
    this.store = store;

    Object.assign(this, {
      baseUrl: "/r",
      eventPrefix: "room:"
    }, options);

    this.rooms = [];

    this._setupEvents();
    this._initialize();
  }

  _setupEvents() {
    let prefix = this.eventPrefix;

    this.events = {
      join: `${prefix}join`,
      leave: `${prefix}leave`,
      content: `${prefix}content`
    }
  }

  _getRoom(name) {
    let rooms = this.rooms;

    if (name in rooms) {
      return Promise.resolve(rooms[name]);
    }

    return this.store.getRoom(name).then((roomInfo) => {
      if (!roomInfo) {
        console.log(`Room ${name} not found.`);
        return;
      }

      return this._createAndReturnRoom(roomInfo);
    });
  }

  _createAndReturnRoom(roomInfo) {
    let name = roomInfo.name;
    let io = this.io;
    let store = this.store;

    // Retrieve recent posts from database
    return store.getPosts(name, { limit: 50 }).then((posts) => {
      let room = new Room(name, {
        password: roomInfo.password,
        contentUrl: roomInfo.contentUrl,
        contentChanged: (url) => {
          store.setContentUrl(name, url);
          io.to(name).emit(this.events.content, url);
        }
      });

      this.rooms[name] = room;
      return room;
    });
  }

  _claimRoom(name) {
    return this.store.claimRoom(name).then((claimInfo) => {
      return claimInfo;
    });
  }

  _initialize() {
    console.log(`Initializing RoomServer on ${this.baseUrl}`);

    this._setupExpress();
    this._setupSocket();
  }

  _setupExpress() {
    let app = this.app;
    let baseUrl = this.baseUrl;

    app.get(`${baseUrl}/:room`, (req, res) => {
      let roomName = req.params.room;

      this._getRoom(roomName).then(room => {
        if (!room) {
          // Room was not found, render claim page
          res.render("claim", {
            room: roomName
          });
          return;
        }

        // Room was found, render room
        res.render("room", {
          room: roomName
        });
      });
    });

    app.post(`${baseUrl}/:room/claim`, (req, res) => {
      let roomName = req.params.room;

      this._claimRoom(roomName).then(claimInfo => {
        if (!claimInfo) {
          console.log(`Room ${roomName} could not be claimed.`);

          res.status(403).send("Room has already been claimed.");
          return;
        }

        res.send(claimInfo);
      });
    });

    app.post(`${baseUrl}/:room/control`, bodyParser.json(), (req, res) => {
      let roomName = req.params.room;

      this._getRoom(roomName).then(room => {
        let data = req.body;

        if (data.password !== room.password) {
          res.status(403).send("You are not authorized.");
          return;
        }

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
    });
  }

  _setupSocket() {
    let io = this.io;

    io.on("connection", (socket) => {
      let ip = socket.handshake.address;
      console.log(`${ip}: Room connected!`);

      let roomsJoined = {};

      socket.on(this.events.join, (roomName) => {
        if (roomName in roomsJoined)
          return;

        console.log(`${ip}: Joining room ${roomName}!`);

        roomsJoined[roomName] = true;
        this._getRoom(roomName).then((room) => {
          socket.join(roomName);

          let contentUrl = room.getContentUrl();
          socket.emit(this.events.content, contentUrl);
        });
      });

      socket.on(this.events.leave, (roomName) => {
        console.log(`${ip}: Leaving room ${roomName}!`);
        socket.leave(roomName);
      });

      socket.on("disconnect", () => {
        console.log(`${ip}: Room disconnected!`);
      });
    });
  }
}

module.exports = {
  server: (app, io, store, options) => {
    return new RoomServer(app, io, store, options);
  }
};
