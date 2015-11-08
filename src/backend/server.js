"use strict";

let path = require("path");
let http = require("http");
let express = require("express");
let exphbs = require("express-handlebars");
let socketio = require("socket.io");

let chat = require("./modules/chat");
let room = require("./modules/room");

// Root dir
let rootDir = path.join(__dirname, "../..");

// Default configuration
let config = {
  port: process.env.PORT || 5000,
  uploadsPath: process.env.UPLOADS_PATH || path.join(rootDir, "uploads"),
  dataStore: "sequelize",
  connectionString: process.env.DATABASE_URL || "postgres://aria:aria@localhost/aria"
};

// Load config file if it is present
try {
  let configFile = process.env.CONFIG || path.join(__dirname, "config.js");

  Object.assign(config, require(configFile));
} catch(e) {}

// Paths
let imagesPath = path.join(config.uploadsPath, "images");

// Create Express app and HTTP server
let app = express();
let server = http.createServer(app);
let io = socketio(server);

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

// Set up room server
let roomStore = room.store(config.dataStore, config.connectionString);
let roomServer = room.server(app, io, roomStore, {
  baseUrl: "/r"
});

// Set up chat server
let chatStore = chat.store(config.dataStore, config.connectionString);
let chatServer = chat.server(app, io, chatStore, {
  baseUrl: "/chat",
  imagesPath: imagesPath
});

// error handling middleware should be loaded after the loading the routes
if ("development" == app.get("env")) {
  let errorhandler = require('errorhandler');

  app.use(errorhandler());
}

let port = app.get("port");

server.listen(port, () => {
  console.log(`Aria listening on port ${port}.`);
});
