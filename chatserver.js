var express = require("express");
var multer = require("multer");
var app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var easyimg = require("easyimage");
var moment = require("moment");

var uploadsPath = __dirname + "/uploads";
var imagesPath = uploadsPath + "/images";

var postUrl = "/post";
var imagesUrl = "/images";

// Serve static shit
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
  constructor() {
    this.posts = [];
  }

  getRecentPosts() {
    return this.posts.slice(-50, -0)
  }
}
var rooms = {};

function getRoom(name) {
  if()
}

function emitPost(res, room, post) {
  rooms[room].posts.push(post);

  io.emit("post", post);
  res.send({
    result: 1
  });
}

app.post(postUrl, upload.single("image"), (req, res) => {
  console.log("Got post");

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
        //console.dir(file);
        post.image = getUrl(req) + imagesUrl + "/" + fileName;
        post.thumbnail = getUrl(req) + imagesUrl + "/" + thumbName;

        emitPost(res, post);
      });
    }
  } else {
    emitPost(res, post);
  }
});

io.on("connection", (socket) => {
  console.log("Connected!");

  socket.on("join", (room) => {
    socket.join(room);

    for (post of posts) {
      socket.emit("post", post);
    }
  });

  socket.on("leave", (room) => {
    socket.leave(room);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected!");
  });
});

http.listen(8080);
