import { Client } from "pg";
import { IChatStore, Image, Post, RoomInfo } from "../chatstore";

interface RoomModel {
  id?: number;
  name?: string;
}

interface ImageModel {
  id?: number;
  filename?: string;
  thumbnail_filename?: string;
  original_filename?: string;
}

interface PostModel {
  id?: number;
  room_id?: number;
  posted?: string;
  name?: string;
  comment?: string;
  image_id?: number;
  ip?: string;
}

class PgChatStore implements IChatStore {
  private client: Client;
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = process.env.DATABASE_URL || connectionString || "postgres://aria:aria@localhost:5432/aria";
    this.client = new Client(this.connectionString);
  }

  async connect() {
    await this.client.connect();
  }

  async _execQuery(sql: string, params: any): Promise<number> {
    const result = await this.client.query(sql, params);

    return result.rowCount;
  }

  async _queryRows(sql: string, params: any): Promise<any[]> {
    const result = await this.client.query(sql, params);

    return result.rows;
  }

  async _insertImage(image: Image): Promise<ImageModel> {
    const rows = await this._queryRows(
      "INSERT INTO chat.images (filename, thumbnail_filename, original_filename)" +
      " VALUES ($1, $2, $3)" +
      " RETURNING id;",
      [image.filename, image.thumbnailFilename, image.originalFilename]);

    return rows[0];
  }

  async _insertPost(roomName: string, post: Post, imageId: number): Promise<PostModel> {
    const rows = await this._queryRows(
      "INSERT INTO chat.posts (room_id, posted, name, comment, image_id, ip)" +
      " SELECT (SELECT id FROM chat.rooms WHERE name = $1), $2, $3, $4, $5, $6" +
      " RETURNING id;",
      [roomName, post.posted, post.name, post.comment, imageId, post.ip]);

    return rows[0];
  }

  async getRoom(roomName: string): Promise<RoomInfo> {
    const rows = await this._queryRows(
      "SELECT name" +
      " FROM chat.rooms" +
      " WHERE name = $1;",
      [roomName]);

    if (!rows || rows.length === 0) {
      return;
    }

    let row = rows[0];
    let room = {
      name: row.name,
    };

    return room;
  }

  async createRoom(roomName: string): Promise<RoomInfo> {
    const rows = await this._queryRows(
      "INSERT INTO chat.rooms (name)" +
      " SELECT $2" +
      " WHERE NOT EXISTS (SELECT * FROM chat.rooms WHERE name = $1)" +
      " RETURNING name;",

      // We need to pass the same parameter twice to avoid 
      // "inconsistent types deduced for parameter" errors
      [roomName, roomName]);

    if (!rows || rows.length === 0) {
      return;
    }

    return rows[0];
  }

  async getPosts(roomName: string, options: any): Promise<Post[]> {
    options = options || {};

    let limit = "";
    if (options.limit)
      limit = ` LIMIT ${options.limit}`;

    let sql =
      "SELECT p2.* FROM (" +
      "SELECT p.id, p.posted, p.name, p.comment, p.ip" +
      ", i.filename, i.thumbnail_filename, i.original_filename" +
      " FROM chat.posts AS p" +
      " INNER JOIN chat.rooms AS r ON p.room_id = r.id" +
      " LEFT JOIN chat.images AS i ON p.image_id = i.id" +
      " WHERE r.name = $1" +
      " ORDER BY p.id DESC" +
      limit +
      ") AS p2 ORDER BY p2.id ASC;";

    const rows = await this._queryRows(sql, [roomName]);

    // Transform raw DB rows into valid internal post objects
    let posts = [];
    for (let row of rows) {
      let post: Post = {
        posted: row.posted,
        name: row.name,
        comment: row.comment,
        ip: row.ip,
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
  }

  async addPost(roomName: string, post: Post): Promise<Post> {
    if (post.image) {
      // Post contained an image - insert image record first
      const image = await this._insertImage(post.image);

      // Insert post record linked to the inserted image
      return <Promise<Post>> this._insertPost(roomName, post, image.id);
    }

    // No image - insert post without image link
    return <Promise<Post>> this._insertPost(roomName, post, null);
  }
}

export function create(connectionString: string) {
  return new PgChatStore(connectionString);
}
