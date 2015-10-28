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

// Get the base URL of a request
function getUrl(req) {
  return req.protocol + "://" + req.get("host");
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
    console.log(`Room ${name} not found. Creating it.`)
    let room = new ChatRoom({
      contentChanged: (url) => {
        io.to(name).emit("content", url);
      },
      postReceived: (post) => {
        console.log(`Post received, emitting it to room ${name}.`)
        io.to(name).emit("post", post);
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

  var post = {
    time: moment().utc().toISOString(),
    name: (req.body.name ? req.body.name : "Anonymous"),
    message: req.body.message,
  };

  var imageFile = req.file;

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
        post.image = getUrl(req) + imagesUrl + "/" + filename;
        post.thumbnail = getUrl(req) + imagesUrl + "/" + thumbFilename;

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
      socket.emit("post", post);
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
