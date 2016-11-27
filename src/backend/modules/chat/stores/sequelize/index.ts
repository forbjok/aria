import * as Promise from "bluebird";
import * as Sequelize from "sequelize";

import * as models from "./models";

export class SequelizeChatStore implements IChatStore {
  sequelize: Sequelize.Sequelize;
  schema: string;
  models: models.ChatModels;

  constructor(public connectionString: string, options:any) {
    Object.assign(this, {
      schema: "chat"
    }, options);

    this.sequelize = new Sequelize(this.connectionString, {
      define: {
        timestamps: false,
        schema: this.schema
      }
    });

    this.models = models.createModels(this.sequelize);
    this.sequelize.createSchema(this.schema, {})
    .catch(() => {})
    .finally(() => {
      this.sequelize.sync();
    });
  }

  _insertImage(image: Image): PromiseLike<models.ImageInstance> {
    return this.models.Image.create({
      filename: image.filename,
      thumbnail_filename: image.thumbnailFilename,
      original_filename: image.originalFilename
    }).then((dbImage) => {
      return dbImage;
    });
  }

  _insertPost(roomName: string, post: Post, imageId: number): PromiseLike<models.PostInstance> {
    return this.models.Room.findOne({
      attributes: ["id"],
      where: {
        name: roomName
      }
    }).then((room) => {
      let roomId = room.id;

      return this.models.Post.create({
        room_id: roomId,
        posted: post.posted,
        name: post.name,
        comment: post.comment,
        image_id: imageId,
        ip: post.ip
      }).then((dbPost) => {
        return dbPost;
      });
    });
  }

  getRoom(roomName: string): PromiseLike<RoomInfo> {
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

  createRoom(roomName: string): PromiseLike<RoomInfo> {
    return this.models.Room.create({
      name: roomName,
    })
    .then((room) => {
      return {
        name: room.name
      };
    });
  }

  getPosts(roomName: string, options: any): PromiseLike<Post[]> {
    options = options || {};

    // First, get the room by name
    return this.models.Room.findOne({
      where: {
        name: roomName
      }
    }).then((room) => {
      let roomId = room.id;

      let query: any = {
        where: {
          room_id: roomId
        },
        include: [
          { model: this.models.Image, as: "image" }
        ],
        order: [
          ["id", "DESC"]
        ]
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
          let post: Post = {
            posted: row.posted,
            name: row.name,
            comment: row.comment,
            ip: row.ip,

            image: null
          };

          let dbImage = row.image;
          if (dbImage) {
            post.image = {
              filename: dbImage.filename,
              thumbnailFilename: dbImage.thumbnail_filename,
              originalFilename: dbImage.original_filename
            };
          }

          /* Because we are receiving the posts in DESCENDING order,
             add each post to the beginning of the array instead of The
             end in order for posts to come out in the correct order. */
          posts.unshift(post);
        }

        return posts;
      });
    });
  }

  addPost(roomName: string, post: Post): PromiseLike<Post> {
    if (post.image) {
      // Post contained an image - insert image record first
      return this._insertImage(post.image)
      .then((image) => {
        // Insert post record linked to the inserted image
        return this._insertPost(roomName, post, image.id).then((row) => {
          let newPost: Post = {
            posted: row.posted,
            name: row.name,
            comment: row.comment,
            ip: row.ip,
          };

          let image = row.image;
          if (image) {
            newPost.image = {
              filename: image.filename,
              thumbnailFilename: image.thumbnail_filename,
              originalFilename: image.original_filename,
            };
          }

          return newPost;
        });
      });
    }

    // No image - insert post without image link
    return this._insertPost(roomName, post, null).then((row) => {
      let newPost: Post = {
        posted: row.posted,
        name: row.name,
        comment: row.comment,
        ip: row.ip,
      };

      let image = row.image;
      if (image) {
        newPost.image = {
          filename: image.filename,
          thumbnailFilename: image.thumbnail_filename,
          originalFilename: image.original_filename,
        };
      }

      return newPost;
    });
  }
}

export function create(connectionString: string, options: any) {
  return new SequelizeChatStore(connectionString, options);
}
