"use strict";

var http = require("http");
var express = require("express");
var multer = require("multer");
var socketio = require("socket.io");
var easyimg = require("easyimage");
var moment = require("moment");

var uploadsPath = __dirname + "/uploads";
var imagesPath = uploadsPath + "/images";

var postUrl = "/:room/post";
var imagesUrl = "/images";

var app = express();
var server = http.Server(app);
var io = socketio(server);

// Set up Express app
app.set("port", process.env.PORT || 5000);

// Serve static shit
app.use("/", express.static(__dirname));
app.use(imagesUrl, express.static(imagesPath));

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

    this.postReceived = options.postReceived;

    this.posts = [];
  }

  getRecentPosts() {
    return this.posts.slice(-50);
  }

  post(post) {
    this.posts.push(post);
    this.postReceived(post);
  }
}

var rooms = {};

function getRoom(name) {
  if (!(name in rooms)) {
    console.log(`Room ${name} not found. Creating it.`)
    let room = new ChatRoom({
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

app.post(postUrl, upload.single("image"), (req, res) => {
  let roomName = req.params.room;

  console.log(`Got post to room ${roomName}.`);

  var post = {
    time: moment().utc().toISOString(),
    name: (req.body.name ? req.body.name : "Anonymous"),
    message: req.body.message,
  };

  var imageFile = req.file;

  if (imageFile) {
    if (imageFile.mimetype.match(/^image\//)) {
      var fileName = imageFile.filename;
      var thumbName = "thumb-" + fileName;

      easyimg.resize({
        src: imageFile.path,
        dst: imagesPath + "/" + thumbName,
        width: 50,
        height: 50
      }).then((file) => {
        post.image = getUrl(req) + imagesUrl + "/" + fileName;
        post.thumbnail = getUrl(req) + imagesUrl + "/" + thumbName;

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

var port = app.get("port");

server.listen(port, () => {
  console.log(`Listening on port ${port}.`);
});
