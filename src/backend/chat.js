"use strict";

let path = require("path");
let express = require("express");
let multer = require("multer");
let easyimg = require("easyimage");
let moment = require("moment");

// Get file extension based on mimetype
function getExtensionByMimetype(mimetype) {
  switch (mimetype) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}

function stripExtension(filename) {
  return path.basename(filename, path.extname(filename));
}

class ChatRoom {
  constructor(name, options) {
    this.name = name;

    Object.assign(this, {
      onPost: () => {}
    }, options);

    if (!this.posts) {
      this.posts = [];
    }
  }

  getRecentPosts() {
    return this.posts.slice(-50);
  }

  post(post) {
    this.posts.push(post);
    this.onPost(post);
  }
}

class ChatServer {
  constructor(app, io, store, options) {
    this.app = app;
    this.io = io;
    this.store = store;

    Object.assign(this, {
      baseUrl: "/chat",
      eventPrefix: "chat:",
      imagesPath: path.join(__dirname, "images")
    }, options);

    this.imagesUrl = this.baseUrl + "/images";
    this.rooms = [];

    this._initialize();
  }

  // Create a post view-model (for websocket use) from an internal post object
  _postToViewModel(post) {
    let vm = {
      posted: post.posted,
      name: post.name,
      comment: post.comment
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

  _getRoom(name) {
    let rooms = this.rooms;

    if (name in rooms) {
      return Promise.resolve(rooms[name]);
    }

    return this.store.getRoom(name).then((roomInfo) => {
      if (!roomInfo) {
        console.log(`Chatroom ${name} not found.`);
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
      let ioRoomName = this.eventPrefix + name;
      let eventPrefix = this.eventPrefix + name + ":";

      let emit = (event, data) => {
        io.to(ioRoomName).emit(eventPrefix + event, data);
      }

      let room = new ChatRoom(name, {
        posts: posts,
        onPost: (post) => {
          store.addPost(name, post);
          emit("post", this._postToViewModel(post));
        }
      });

      this.rooms[name] = room;
      return room;
    });
  }

  _initialize() {
    console.log(`Initializing ChatServer on ${this.baseUrl}`);

    this._setupExpress();
    this._setupSocket();
  }

  _setupExpress() {
    let app = this.app;
    let imagesPath = this.imagesPath;
    let baseUrl = this.baseUrl;

    // Serve images
    app.use(this.imagesUrl, express.static(this.imagesPath));

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
      storage: multerStorage
    });

    let emitPost = (roomName, post) => {
      return this._getRoom(roomName).then((room) => {
        room.post(post);
      });
    }

    app.post(`${baseUrl}/:room/post`, upload.single("image"), (req, res) => {
      let roomName = req.params.room;

      console.log(`Got post to room ${roomName}.`);

      let post = {
        posted: moment().utc().toISOString(),
        name: req.body.name ? req.body.name : "Anonymous",
        comment: req.body.comment,
        ip: req.ip
      };

      let imageFile = req.file;

      if (imageFile) {
        if (imageFile.mimetype.match(/^image\//)) {
          let filename = imageFile.filename;
          let thumbFilename = "thumb-" + stripExtension(filename) + ".jpg";

          easyimg.resize({
            src: imageFile.path,
            dst: path.join(imagesPath, thumbFilename),
            width: 100,
            height: 100,
            quality: 80,
            background: "#D6DAF0"
          }).then((file) => {
            post.image = {
              filename: filename,
              thumbnailFilename: thumbFilename,
              originalFilename: imageFile.originalname
            }

            emitPost(roomName, post).then(() => {
              res.send();
            });
          });
        }
      } else {
        emitPost(roomName, post).then(() => {
          res.send();
        });
      }
    });
  }

  _setupSocket() {
    let io = this.io;

    io.on("connection", (socket) => {
      let ip = socket.handshake.address;
      console.log(`${ip}: Chat connected!`);

      let roomsJoined = {};

      socket.on(this.eventPrefix + "join", (roomName) => {
        if (roomName in roomsJoined) {
          return;
        }

        console.log(`${ip}: Joining chatroom ${roomName}!`);

        roomsJoined[roomName] = true;
        this._getRoom(roomName).then((room) => {
          socket.join(this.eventPrefix + roomName);

          console.log(`${ip}: Sending recent posts.`);
          let recentPosts = room.getRecentPosts();

          let postEvent = this.eventPrefix + roomName + ":post";

          for (let post of recentPosts) {
            socket.emit(postEvent, this._postToViewModel(post));
          }
        });
      });

      socket.on(this.eventPrefix + "leave", (roomName) => {
        console.log(`${ip}: Leaving chatroom ${roomName}!`);
        socket.leave(this.eventPrefix + roomName);
      });

      socket.on("disconnect", () => {
        console.log(`${ip}: Chat disconnected!`);
      });
    });
  }
}

module.exports = {
  server: (app, io, store, options) => {
    return new ChatServer(app, io, store, options);
  }
};
