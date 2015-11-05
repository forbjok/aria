"use strict";

var path = require("path");
var http = require("http");
var express = require("express");
var exphbs = require("express-handlebars");
var bodyParser = require("body-parser");
var multer = require("multer");
var socketio = require("socket.io");
var easyimg = require("easyimage");
var moment = require("moment");
var config = require("./config");

// Paths
var rootDir = path.join(__dirname, "../..");
var imagesPath = path.join(config.uploadsPath, "images");

// URLs
var imagesUrl = "/images";

// Create Express app and HTTP server
var app = express();
var server = http.createServer(app);
var io = socketio(server);

// Set up Express app
app.set("port", config.port);
app.enable("trust proxy"); // Required for req.ip to work correctly behind a proxy

// Serve static shit
app.use("/dist", express.static(path.join(rootDir, "dist")));
app.use("/jspm_packages", express.static(path.join(rootDir, "jspm_packages")));
app.use("/config.js", express.static(path.join(rootDir, "config.js")));
app.use(imagesUrl, express.static(imagesPath));

// Set up view engine
app.engine("handlebars", exphbs({
  layoutsDir: path.join(__dirname, "views/layouts/"),
  partialsDir: path.join(__dirname, "views/partials/")
}));

app.set("view engine", "handlebars");
app.set("views", path.join(__dirname, "views"));

var ariaStore = config.dataStore.create();

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

// Set up multer storage for uploaded images
var storage = multer.diskStorage({
  destination: imagesPath,
  filename: (req, file, cb) => {
    var extension = getExtensionByMimetype(file.mimetype);
    var filename = moment().utc().valueOf().toString() + extension;

    cb(null, filename);
  }
});

// Set up multer uploader
var upload = multer({
  storage: storage
});

// Create a post view-model (for websocket use) from an internal post object
function postToViewModel(post) {
  let vm = {
    posted: post.posted,
    name: post.name,
    comment: post.comment
  };

  if(post.image) {
    vm.image = {
      url: `${imagesUrl}/${post.image.filename}`,
      thumbUrl: `${imagesUrl}/${post.image.thumbnailFilename}`,
      originalFilename: post.image.originalFilename
    };
  }

  return vm;
}

class ChatRoom {
  constructor(options) {
    options = options || {};

    this.password = options.password;
    this.contentChanged = options.contentChanged;
    this.postReceived = options.postReceived;

    this.contentUrl = options.contentUrl || "about:blank";
    this.posts = options.posts || [];
  }

  getContentUrl() {
    return this.contentUrl; //"http://www.ustream.tv/embed/16698010?html5ui";
  }

  setContentUrl(url) {
    this.contentUrl = url;
    this.contentChanged(this.contentUrl);
  }

  getRecentPosts() {
    return this.posts.slice(-50);
  }

  post(post) {
    this.posts.push(post);
    this.postReceived(post);
  }
}

// Global variables
var rooms = {};

function createAndReturnRoom(roomInfo) {
  let name = roomInfo.name;

  // Retrieve recent posts from database
  return ariaStore.getPosts(name, { limit: 50 }).then((posts) => {
    let room = new ChatRoom({
      password: roomInfo.password,
      posts: posts,
      contentUrl: roomInfo.contentUrl,
      contentChanged: (url) => {
        ariaStore.setContentUrl(name, url);
        io.to(name).emit("content", url);
      },
      postReceived: (post) => {
        console.log(`Post received, emitting it to room ${name}.`);
        ariaStore.addPost(name, post);
        io.to(name).emit("post", postToViewModel(post));
      }
    });

    rooms[name] = room;
    return room;
  });
}

// Get a room
function getRoom(name) {
  if (name in rooms) {
    return Promise.resolve(rooms[name]);
  }

  return ariaStore.getRoom(name).then((roomInfo) => {
    if (!roomInfo) {
      console.log(`Room ${name} not found.`);
      return;
    }

    return createAndReturnRoom(roomInfo);
  });
}

function claimRoom(name) {
  return ariaStore.claimRoom(name).then((claimInfo) => {
    return claimInfo;
  });
}

function emitPost(res, roomName, post) {
  return getRoom(roomName).then((room) => {
    room.post(post);
  });
}

app.get("/r/:room", (req, res) => {
  let roomName = req.params.room;

  getRoom(roomName).then(room => {
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

app.post("/r/:room/claim", (req, res) => {
  let roomName = req.params.room;

  claimRoom(roomName).then((claimInfo) => {
    if (!claimInfo) {
      console.log(`Room ${roomName} could not be claimed.`);

      res.status(403).send("Room has already been claimed.");
      return;
    }

    res.send(claimInfo);
  });
});

app.post("/r/:room/control", bodyParser.json(), (req, res) => {
  let roomName = req.params.room;

  getRoom(roomName).then(room => {
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

app.get("/chat/:room", (req, res) => {
  res.render("chat", {
    room: req.params.room
  });
});

var contentRegex = /^\/content\s+(.+)$/g;

app.post("/chat/:room/post", upload.single("image"), (req, res) => {
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
      var filename = imageFile.filename;
      var thumbFilename = `thumb-${stripExtension(filename)}.jpg`;

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

        emitPost(res, roomName, post).then(() => {
          res.send();
        });
      });
    }
  } else {
    emitPost(res, roomName, post).then(() => {
      res.send();
    });
  }
});

io.on("connection", (socket) => {
  console.log("Connected!");

  let roomsJoined = {};

  socket.on("join", (roomName) => {
    if (roomName in roomsJoined)
      return;

    console.log(`Joining room ${roomName}!`);

    roomsJoined[roomName] = true;
    getRoom(roomName).then((room) => {
      socket.join(roomName);

      let contentUrl = room.getContentUrl();
      console.log("Sending content url: " + contentUrl);
      socket.emit("content", contentUrl);

      console.log("Sending recent posts.");
      let recentPosts = room.getRecentPosts();

      for (let post of recentPosts) {
        socket.emit("post", postToViewModel(post));
      }
    });
  });

  socket.on("leave", (roomName) => {
    console.log(`Leaving room ${roomName}!`);
    socket.leave(roomName);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected!");
  });
});

// error handling middleware should be loaded after the loading the routes
if ("development" == app.get("env")) {
  var errorhandler = require('errorhandler');

  app.use(errorhandler());
}

var port = app.get("port");

server.listen(port, () => {
  console.log(`Aria listening on port ${port}.`);
});
