"use strict";

let Sequelize = require("sequelize");

let models = require("./models");

class SequelizeChatStore {
  constructor(connectionString, options) {
    Object.assign(this, {
      schema: "chat"
    }, options);

    this.connectionString = connectionString;

    this.sequelize = new Sequelize(this.connectionString, {
      define: {
        timestamps: false,
        schema: this.schema
      }
    });

    this.models = models(this.sequelize);
    this.sequelize.createSchema(this.schema)
    .catch(() => {})
    .finally(() => {
      this.sequelize.sync();
    });
  }

  _insertImage(image) {
    return this.models.Image.create({
      filename: image.filename,
      thumbnail_filename: image.thumbnailFilename,
      original_filename: image.originalFilename
    }).then((dbImage) => {
      return dbImage.save().then(() => {
        return dbImage.id;
      });
    });
  }

  _insertPost(roomName, post, imageId) {
    return this.models.Room.findOne({
      attributes: ["id"],
      where: {
        name: roomName
      }
    }).then((room) => {
      let roomId = room.id;

      let dbPost = this.models.Post.create({
        room_id: roomId,
        posted: post.posted,
        name: post.name,
        comment: post.comment,
        image_id: imageId,
        ip: post.ip
      }).then((dbPost) => {
        return dbPost.id;
      });
    });
  }

  getRoom(roomName) {
    return this.models.Room.findOne({
      where: {
        name: roomName
      }
    }).then((room) => {
      if (!room) {
        // Room was not found - return nothing
        return;
      }

      // Room was found, return it
      return {
        name: room.name
      };
    });
  }

  createRoom(roomName) {
    return this.models.Room.create({
      name: roomName,
    })
    .then((room) => {
      return {
        name: room.name
      };
    });
  }

  getPosts(roomName, options) {
    options = options || {};

    // First, get the room by name
    return this.models.Room.findOne({
      where: {
        name: roomName
      }
    }).then((room) => {
      let roomId = room.id;

      let query = {
        where: {
          room_id: roomId
        }
      };

      // If a limits option was specified, add it to the query
      let limit = "";
      if (options.limit) {
        query.limit = options.limit;
      }

      // Query posts
      return this.models.Post.findAll(query)
      .then((rows) => {
        // Transform raw DB rows into valid internal post objects
        let posts = [];
        for (let row of rows) {
          let post = {
            posted: row.posted,
            name: row.name,
            comment: row.comment,
            ip: row.ip
          };

          if (row.filename) {
            post.image = {
              filename: row.filename,
              thumbnailFilename: row.thumbnail_filename,
              originalFilename: row.original_filename
            };
          }

          posts.push(post);
        }

        return posts;
      });
    });
  }

  addPost(roomName, post) {
    if (post.image) {
      // Post contained an image - insert image record first
      return this._insertImage(post.image)
      .then((image) => {
        // Insert post record linked to the inserted image
        return this._insertPost(roomName, post, image.id);
      });
    }

    // No image - insert post without image link
    return this._insertPost(roomName, post, null);
  }
}

function create(connectionString, options) {
  return new SequelizeChatStore(connectionString, options);
}

module.exports = {
  create: create
};
