/// <reference types="node" />

import * as path from "path";
import * as http from "http";
import * as express from "express";
import * as socketio from "socket.io";

import * as chat from "./modules/chat/index";
import * as room from "./modules/room/index";

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
let io = socketio(server, { path: "/aria-ws"});

// Set up Express app
app.set("port", config.port);
app.enable("trust proxy"); // Required for req.ip to work correctly behind a proxy

// Set up room server
let roomStore = room.store(config.dataStore, config.connectionString);
let roomServer = room.server(app, io, roomStore, {
  baseUrl: "/api/r",
});

// Set up chat server
let chatStore = chat.store(config.dataStore, config.connectionString);
let chatServer = chat.server(app, io, chatStore, {
  baseUrl: "/api/chat",
  imagesPath: imagesPath
});

// error handling middleware should be loaded after the loading the routes
if ("development" == app.get("env")) {
  let errorhandler = require('errorhandler');

  app.use(errorhandler());
}

let port = app.get("port");

server.listen(port, () => {
  console.log(`Aria backend listening on port ${port}.`);
});
