import * as fs from "fs";
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

async function migrate_old_images(filesPath: string, store: PgAriaStore, imageService: ImageService) {
  const images = await store.getAllImages();

  for (const i of images) {
    if (i.hash) {
      continue;
    }

    const srcPath = path.join(filesPath, "images", i.path);
    if (!fs.existsSync(srcPath)) {
      console.log("Image does not exist", srcPath, i.id);
      continue;
    }

    const { hash, imageExt, thumbExt } = await imageService.processImage(srcPath);

    i.hash = hash;
    i.ext = imageExt;
    i.tn_ext = thumbExt;

    await store.updateImage(i);
  }
}

async function main(): Promise<void> {
  // Default configuration
  const config = {
    port: process.env.PORT || 5000,
    tempPath: process.env.UPLOADS_PATH || path.join(getCacheFolder(), "aria", "temp"),
    uploadsPath: process.env.UPLOADS_PATH || path.join(getCacheFolder(), "aria", "uploads"),
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
  app.use(filesUrl, express.static(config.uploadsPath, { maxAge: "1 hour" }));

  const store = new PgAriaStore(config.connectionString);
  await store.connect();
  await store.migrate();

  const imageService = new ImageService(config.uploadsPath);

  // Run migration of old images
  await migrate_old_images(config.uploadsPath, store, imageService);

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
