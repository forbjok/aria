import * as path from "path";
import * as http from "http";
import * as errorhandler from "errorhandler";
import * as express from "express";
import { getCacheFolder } from "platform-folders";
import * as socketio from "socket.io";

import { PgAriaStore } from "./store/postgres";
import { ChatServer } from "./modules/chat/server";
import { RoomServer } from "./modules/room/server";
import { ImageService } from "./services/image";

async function main(): Promise<void> {
  // Default configuration
  const config = {
    port: process.env.PORT || 5000,
    tempPath: process.env.TEMP_PATH || path.join(getCacheFolder(), "aria", "temp"),
    filesPath: process.env.FILES_PATH || path.join(getCacheFolder(), "aria", "files"),
    connectionString: process.env.DATABASE_URL || "postgres://aria:aria@localhost/aria",
  };

  const filesUrl = "/f";

  // Create Express app and HTTP server
  const app = express();
  const server = http.createServer(app);
  const io = new socketio.Server(server, { path: "/aria-ws" });

  // Set up Express app
  app.set("port", config.port);
  app.enable("trust proxy"); // Required for req.ip to work correctly behind a proxy

  // Serve files
  app.use(filesUrl, express.static(config.filesPath, { maxAge: "1 hour" }));

  const store = new PgAriaStore(config.connectionString);
  await store.connect();
  await store.migrate();

  const imageService = new ImageService(config.filesPath);

  // Set up room server
  new RoomServer(app, io, store, {
    baseUrl: "/api/r",
  });

  // Set up chat server
  new ChatServer(app, io, store, imageService, {
    baseUrl: "/api/chat",
    tempPath: config.tempPath,
    imagesUrl: filesUrl,
  });

  // error handling middleware should be loaded after the loading the routes
  if (app.get("env") == "development") {
    app.use(errorhandler());
  }

  const port = app.get("port");

  server.listen(port, () => {
    console.log(`Aria backend listening on port ${port}.`);
  });
}

main();
