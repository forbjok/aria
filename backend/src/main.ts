/// <reference types="node" />

import * as path from "path";
import * as http from "http";
import * as express from "express";
import * as exphbs from "express-handlebars";
import * as socketio from "socket.io";

import * as vary from "./middlewares/vary";

import * as chat from "./modules/chat/index";
import * as room from "./modules/room/index";

// Root dir
let rootDir = path.join(__dirname, "../..");
let frontendDir = path.join(rootDir, "frontend");

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

// Add middlewares
//app.use(vary());

// Serve static shit
app.use("/dist", express.static(path.join(frontendDir, "dist"), { maxAge: "1 minute" }));
app.use("/jspm_packages", express.static(path.join(frontendDir, "jspm_packages"), { maxAge: "1 minute" }));
app.use("/config.js", express.static(path.join(frontendDir, "config.js"), { maxAge: "1 minute" }));

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
