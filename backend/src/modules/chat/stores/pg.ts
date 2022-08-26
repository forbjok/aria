import * as pg from "pg";
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
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = process.env.DATABASE_URL || connectionString || "postgres://aria:aria@localhost:5432/aria";
  }

  _execQuery(sql: string, params: any): PromiseLike<number> {
    return new Promise((resolve, reject) => {
      pg.connect(this.connectionString, (err, client, done) => {
        if (err) {
          throw new Error(`Error connecting to PostgreSQL server '${this.connectionString}': ${err.message}`);
        }

        client.query(sql, params, (err, result) => {
          done();

          if (err) {
            throw new Error(`Error executing query: ${sql} with parameters ${params}: ${err.message}`);
          }

          resolve(result.rowCount);
        });
      });
    });
  }

  _queryRows(sql: string, params: any): PromiseLike<any[]> {
    return new Promise((resolve, reject) => {
      pg.connect(this.connectionString, (err, client, done) => {
        if (err) {
          throw new Error(`Error connecting to PostgreSQL server '${this.connectionString}': ${err.message}`);
        }

        client.query(sql, params, (err, result) => {
          done();

          if (err) {
            throw new Error(`Error executing query: ${sql} with parameters ${params}: ${err.message}`);
          }

          resolve(result.rows);
        });
      });
    });
  }

  _insertImage(image: Image): PromiseLike<ImageModel> {
    return this._queryRows(
      "INSERT INTO chat.images (filename, thumbnail_filename, original_filename)" +
      " VALUES ($1, $2, $3)" +
      " RETURNING id;",
      [image.filename, image.thumbnailFilename, image.originalFilename])
      .then((rows) => {
        return rows[0];
      });
  }

  _insertPost(roomName: string, post: Post, imageId: number): PromiseLike<PostModel> {
    return this._queryRows(
      "INSERT INTO chat.posts (room_id, posted, name, comment, image_id, ip)" +
      " SELECT (SELECT id FROM chat.rooms WHERE name = $1), $2, $3, $4, $5, $6" +
      " RETURNING id;",
      [roomName, post.posted, post.name, post.comment, imageId, post.ip])
      .then((rows) => {
        return rows[0];
      });
  }

  getRoom(roomName: string): PromiseLike<RoomInfo> {
    return this._queryRows(
      "SELECT name" +
      " FROM chat.rooms" +
      " WHERE name = $1;",
      [roomName])
      .then((rows) => {
        if (!rows || rows.length === 0) {
          return;
        }

        let row = rows[0];
        let room = {
          name: row.name,
        };

        return room;
      });
  }

  createRoom(roomName: string): PromiseLike<RoomInfo> {
    return this._queryRows(
      "INSERT INTO chat.rooms (name)" +
      " SELECT $2" +
      " WHERE NOT EXISTS (SELECT * FROM chat.rooms WHERE name = $1)" +
      " RETURNING name;",

      /* We need to pass the same parameter twice to avoid 
         "inconsistent types deduced for parameter" errors */
      [roomName, roomName]).then((rows) => {
        if (!rows || rows.length === 0) {
          return;
        }

        return rows[0];
      });
  }

  getPosts(roomName: string, options: any): PromiseLike<Post[]> {
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

    return this._queryRows(sql, [roomName])
      .then((rows) => {
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
      });
  }

  addPost(roomName: string, post: Post): PromiseLike<Post> {
    if (post.image) {
      // Post contained an image - insert image record first
      return this._insertImage(post.image)
      .then((image) => {
        // Insert post record linked to the inserted image
        return <PromiseLike<Post>> this._insertPost(roomName, post, image.id);
      });
    }

    // No image - insert post without image link
    return <PromiseLike<Post>> this._insertPost(roomName, post, null);
  }
}

export function create(connectionString: string) {
  return new PgChatStore(connectionString);
}
