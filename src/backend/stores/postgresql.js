"use strict";

var Promise = require("bluebird");
var pg = Promise.promisifyAll(require("pg"));

function execQuery(connectionString, sql, params) {
  return Promise.try(() => {
    return pg.connectAsync(connectionString).then((client) => {
      return client.queryAsync(sql, params)
      .then((result) => {
        return result.rowCount;
      })
      .catch((err) => {
        throw new Error(`Error executing query: ${sql} with parameters ${params}: ${err.cause}`);
      })
    });
  });
}

function queryRows(connectionString, sql, params, cb) {
  return Promise.try(() => {
    return pg.connectAsync(connectionString).then((client) => {
      return client.queryAsync(sql, params)
      .then((result) => {
        return result.rows;
      })
      .catch((err) => {
        throw new Error(`Error executing query: ${sql} with parameters ${params}: ${err.cause}`);
      });
    });
  });
}

function insertImage(connectionString, image) {
  return Promise.try(() => {
    return queryRows(connectionString,
      "INSERT INTO images (filename, thumbnail_filename, original_filename)" +
      " VALUES ($1, $2, $3)" +
      " RETURNING id;",
      [image.filename, image.thumbnailFilename, image.originalFilename])
      .then((rows) => {
        return rows[0];
      });
  });
}

function insertPost(connectionString, roomName, post, imageId, cb) {
  return Promise.try(() => {
    return queryRows(connectionString,
      "INSERT INTO posts (room_id, posted, name, comment, image_id, ip)" +
      " SELECT (SELECT id FROM rooms WHERE name = $1), $2, $3, $4, $5, $6" +
      " RETURNING id;",
      [roomName, post.posted, post.name, post.comment, imageId, post.ip])
      .then((rows) => {
        return rows[0];
      });
  });
}

class PostgreSqlStore {
  constructor(connectionString) {
    this.connectionString = process.env.DATABASE_URL || connectionString || "postgres://aria:aria@localhost:5432/aria";
  }

  getRoom(roomName) {
    return queryRows(this.connectionString,
      "SELECT name, content_url, password, claimed, expires" +
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
          contentUrl: row.content_url,
          password: row.password,
          claimed: row.claimed,
          expires: row.expires
        };

        return room;
      });
  }

  claimRoom(roomName) {
    return Promise.try(() => {
      return execQuery(this.connectionString,
        "INSERT INTO rooms (name, content_url, password, claimed, expires)" +
        " SELECT $1, $2, $3, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC' + INTERVAL '1 day'" +
        " WHERE NOT EXISTS (SELECT * FROM rooms WHERE name = $1 AND expires > NOW() AT TIME ZONE 'UTC')" +
        " RETURNING name, password, content_url;",
        [roomName, "about:blank", "123"])
        .then((rowsAffected) => {
          return rowsAffected === 1;
        })
    });
  }

  setContentUrl(roomName, contentUrl) {
    return execQuery(this.connectionString,
      "UPDATE rooms" +
      " SET content_url = $2" +
      " WHERE name = $1;",
      [roomName, contentUrl])
      .then((rowsAffected) => {
        return rowsAffected === 1;
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

    return queryRows(this.connectionString, sql, [roomName])
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
      return insertImage(this.connectionString, post.image)
      .then((image) => {
        // Insert post record linked to the inserted image
        return insertPost(this.connectionString, roomName, post, image.id);
      });
    }

    // No image - insert post without image link
    return insertPost(this.connectionString, roomName, post, null);
  }
}

function create(connectionString) {
  return new PostgreSqlStore(connectionString);
}

module.exports = {
  create: create
};
