import { Sequelize } from "sequelize";
import { IChatStore, Image, Post, QueryOptions, RoomInfo } from "../../chatstore";

import * as models from "./models";

export interface SequelizeChatStoreOptions {
  schema?: string;
}

export class SequelizeChatStore implements IChatStore {
  sequelize: Sequelize;
  schema: string;
  models: models.ChatModels;

  constructor(public connectionString: string, options: SequelizeChatStoreOptions) {
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

  async _insertImage(image: Image): Promise<models.ImageModel> {
    let dbImage = await this.models.Image.create({
      filename: image.filename,
      thumbnail_filename: image.thumbnailFilename,
      original_filename: image.originalFilename
    });

    return dbImage;
  }

  async _insertPost(roomName: string, post: Post, imageId: number): Promise<models.PostModel> {
    let room = await this.models.Room.findOne({
      attributes: ["id"],
      where: {
        name: roomName
      }
    });

    let roomId = room.id;

    let dbPost = await this.models.Post.create({
      room_id: roomId,
      posted: post.posted,
      name: post.name,
      comment: post.comment,
      image_id: imageId,
      ip: post.ip,
    });

    return dbPost;
  }

  async getRoom(roomName: string): Promise<RoomInfo> {
    let room = await this.models.Room.findOne({
      where: {
        name: roomName,
      }
    });

    if (!room) {
      // Room was not found - return nothing
      return;
    }

    // Room was found, return it
    return <RoomInfo> {
      name: room.name,
    };
  }

  async createRoom(roomName: string): Promise<RoomInfo> {
    let room = await this.models.Room.create({ name: roomName });

    return <RoomInfo> {
      name: room.name,
    };
  }

  async getPosts(roomName: string, options: QueryOptions): Promise<Post[]> {
    options = options || {};

    // First, get the room by name
    let room = await this.models.Room.findOne({
      where: {
        name: roomName,
      }
    });

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
    let rows = await this.models.Post.findAll(query);

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
  }

  async addPost(roomName: string, post: Post): Promise<Post> {
    if (post.image) {
      // Post contained an image - insert image record first
      let image = await this._insertImage(post.image);

      // Insert post record linked to the inserted image
      let row = await this._insertPost(roomName, post, image.id);

      let newPost: Post = {
        posted: row.posted,
        name: row.name,
        comment: row.comment,
        ip: row.ip,
      };

      image = row.image;
      if (image) {
        newPost.image = {
          filename: image.filename,
          thumbnailFilename: image.thumbnail_filename,
          originalFilename: image.original_filename,
        };
      }

      return newPost;
    }

    // No image - insert post without image link
    let row = await this._insertPost(roomName, post, null);

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
  }
}

export function create(connectionString: string, options: SequelizeChatStoreOptions) {
  return new SequelizeChatStore(connectionString, options);
}
