"use strict";

var path = require("path");
var http = require("http");
var express = require("express");
var exphbs = require("express-handlebars");
var socketio = require("socket.io");

var config = require("./config");
var chat = require("./chat")
var room = require("./room")

// Paths
var rootDir = path.join(__dirname, "../..");
var imagesPath = path.join(config.uploadsPath, "images");

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

// Set up view engine
app.engine("handlebars", exphbs({
  layoutsDir: path.join(__dirname, "views/layouts/"),
  partialsDir: path.join(__dirname, "views/partials/")
}));

app.set("view engine", "handlebars");
app.set("views", path.join(__dirname, "views"));

var ariaStore = config.dataStore.create();

// Set up chat server
var roomServer = room.server(app, io, ariaStore, {
  baseUrl: "/r"
});

var chatServer = chat.server(app, io, ariaStore, {
  baseUrl: "/chat",
  imagesPath: imagesPath
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
