"use strict";

var path = require("path");
var http = require("http");
var express = require("express");
var exphbs = require("express-handlebars");
var multer = require("multer");
var socketio = require("socket.io");
var easyimg = require("easyimage");
var moment = require("moment");

var rootDir = path.join(__dirname, "../..");

// Paths
var uploadsPath = path.join(rootDir, "uploads");
var imagesPath = path.join(uploadsPath, "images");

// URLs
var imagesUrl = "/images";

// Create Express app and HTTP server
var app = express();
var server = http.createServer(app);
var io = socketio(server);

// Set up Express app
app.set("port", process.env.PORT || 5000);
app.enable("trust proxy"); // Required for req.ip to work correctly behind a proxy

// Serve static shit
app.use("/dist", express.static(path.join(rootDir, "dist")));
app.use("/styles", express.static(path.join(rootDir, "styles")));
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

var pgstore = require("./pgstore");
var ariaStore = pgstore.postgresql();

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
    time: post.posted,
    name: post.name,
    message: post.comment
  };

  if(post.image) {
    vm.image = `${imagesUrl}/${post.image.filename}`;
    vm.thumbnail = `${imagesUrl}/${post.image.thumbnailFilename}`;
  }

  return vm;
}

class ChatRoom {
  constructor(options) {
    options = options || {};

    this.contentChanged = options.contentChanged;
    this.postReceived = options.postReceived;

    this.contentUrl = "about:blank";
    this.posts = [];
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

// Get a room or create, add and return it if it does not exist
function getRoom(name) {
  if (!(name in rooms)) {
    console.log(`Room ${name} not found. Creating it.`);

    ariaStore.claimRoom(name);

    let room = new ChatRoom({
      contentChanged: (url) => {
        io.to(name).emit("content", url);
      },
      postReceived: (post) => {
        console.log(`Post received, emitting it to room ${name}.`);
        ariaStore.addPost(name, post);
        io.to(name).emit("post", postToViewModel(post));
      }
    });

    // Retrieve recent posts from database
    ariaStore.getPosts(name, { limit: 50 }, (posts) => {
      for (let post of posts) {
        room.post(post);
      }
    });

    rooms[name] = room;
    return room;
  }

  return rooms[name];
}

function emitPost(res, roomName, post) {
  let room = getRoom(roomName);

  room.post(post);

  res.send({
    result: 1
  });
}

app.get("/r/:room", (req, res) => {
  console.log(`Room! ${req.params.room}`);
  res.render("room", {
    room: req.params.room
  });
});

app.get("/chat/:room", (req, res) => {
  console.log(`Chat! ${req.params.room}`);
  res.render("chat", {
    room: req.params.room
  });
});

var contentRegex = /^\/content\s+(.+)$/g;

app.post("/chat/:room/post", upload.single("image"), (req, res) => {
  let roomName = req.params.room;

  if(req.body.message[0] === "/") {
    console.log("Command detected");

    let contentUrl = contentRegex.exec(req.body.message)[1];
    console.log("COTL", contentUrl);

    let room = getRoom(roomName);
    room.setContentUrl(contentUrl);

    res.send({
      result: 1
    });
    return;
  }

  console.log(`Got post to room ${roomName}.`);

  let post = {
    posted: moment().utc().toISOString(),
    name: req.body.name ? req.body.name : "Anonymous",
    comment: req.body.message,
    ip: req.ip
  };

  let imageFile = req.file;

  if (imageFile) {
    if (imageFile.mimetype.match(/^image\//)) {
      var filename = imageFile.filename;
      var thumbFilename = `thumb-${filename}`;

      easyimg.resize({
        src: imageFile.path,
        dst: path.join(imagesPath, thumbFilename),
        width: 50,
        height: 50
      }).then((file) => {
        post.image = {
          filename: filename,
          thumbnailFilename: thumbFilename,
          originalFilename: imageFile.originalname
        }

        emitPost(res, roomName, post);
      });
    }
  } else {
    emitPost(res, roomName, post);
  }
});

io.on("connection", (socket) => {
  console.log("Connected!");

  socket.on("join", (roomName) => {
    console.log(`Joining room ${roomName}!`);
    let room = getRoom(roomName);
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
  console.log(`Listening on port ${port}.`);
});
