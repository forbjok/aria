import * as path from "path";
import * as http from "http";
import * as express from "express";
import { getCacheFolder } from "platform-folders";
import * as socketio from "socket.io";

import * as chat from "./modules/chat/index";
import * as room from "./modules/room/index";
import { PgAriaStore } from "./store/postgres";

async function main(): Promise<void> {
  // Root dir
  let rootDir = path.join(__dirname, "../..");

  // Default configuration
  let config = {
    port: process.env.PORT || 5000,
    uploadsPath: process.env.UPLOADS_PATH || path.join(getCacheFolder(), "aria", "uploads"),
    connectionString: process.env.DATABASE_URL || "postgres://aria:aria@localhost/aria"
  };

  // Load config file if it is present
  try {
    let configFile = process.env.CONFIG || path.join(__dirname, "config.ts");

    Object.assign(config, require(configFile));
  } catch(e) {}

  // Paths
  let imagesPath = path.join(config.uploadsPath, "images");

  // Create Express app and HTTP server
  let app = express();
  let server = http.createServer(app);
  let io = new socketio.Server(server, { path: "/aria-ws"});

  // Set up Express app
  app.set("port", config.port);
  app.enable("trust proxy"); // Required for req.ip to work correctly behind a proxy

  const store = new PgAriaStore(config.connectionString);
  await store.connect();
  await store.migrate();

  // Set up room server
  let roomServer = room.server(app, io, store, {
    baseUrl: "/api/r",
  });

  // Set up chat server
  let chatServer = chat.server(app, io, store, {
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
}

main();