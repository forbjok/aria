"use strict";

let Promise = require("bluebird");
let pg = require("pg");

class PgChatStore {
  constructor(connectionString) {
    this.connectionString = process.env.DATABASE_URL || connectionString || "postgres://aria:aria@localhost:5432/aria";
  }

  _execQuery(sql, params) {
    return new Promise((resolve, reject) => {
      pg.connect(this.connectionString, (err, client, done) => {
        if (err) {
          throw new Error(`Error connecting to PostgreSQL server '${this.connectionString}': ${err.cause}`);
        }

        client.query(sql, params, (err, result) => {
          done();

          if (err) {
            throw new Error(`Error executing query: ${sql} with parameters ${params}: ${err.cause}`);
          }

          resolve(result.rowCount);
        });
      });
    });
  }

  _queryRows(sql, params) {
    return new Promise((resolve, reject) => {
      pg.connect(this.connectionString, (err, client, done) => {
        if (err) {
          throw new Error(`Error connecting to PostgreSQL server '${this.connectionString}': ${err.cause}`);
        }

        client.query(sql, params, (err, result) => {
          done();

          if (err) {
            throw new Error(`Error executing query: ${sql} with parameters ${params}: ${err.cause}`);
          }

          resolve(result.rows);
        });
      });
    });
  }

  _insertImage(image) {
    return this._queryRows(
      "INSERT INTO images (filename, thumbnail_filename, original_filename)" +
      " VALUES ($1, $2, $3)" +
      " RETURNING id;",
      [image.filename, image.thumbnailFilename, image.originalFilename])
      .then((rows) => {
        return rows[0];
      });
  }

  _insertPost(roomName, post, imageId) {
    return this._queryRows(
      "INSERT INTO posts (room_id, posted, name, comment, image_id, ip)" +
      " SELECT (SELECT id FROM rooms WHERE name = $1), $2, $3, $4, $5, $6" +
      " RETURNING id;",
      [roomName, post.posted, post.name, post.comment, imageId, post.ip])
      .then((rows) => {
        return rows[0];
      });
  }

  getRoom(roomName) {
    return this._queryRows(
      "SELECT name" +
      " FROM rooms" +
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

  getPosts(roomName, options) {
    options = options || {};

    let limit = "";
    if (options.limit)
      limit = ` LIMIT ${options.limit}`;

    let sql =
      "SELECT p2.* FROM (" +
      "SELECT p.id, p.posted, p.name, p.comment, p.ip" +
      ", i.filename, i.thumbnail_filename, i.original_filename" +
      " FROM posts AS p" +
      " INNER JOIN rooms AS r ON p.room_id = r.id" +
      " LEFT JOIN images AS i ON p.image_id = i.id" +
      " WHERE r.name = $1" +
      " ORDER BY p.id DESC" +
      limit +
      ") AS p2 ORDER BY p2.id ASC;";

    return this._queryRows(sql, [roomName])
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

function create(connectionString) {
  return new PgChatStore(connectionString);
}

module.exports = {
  create: create
};
