"use strict";

var pg = require("pg");

var noop = () => {};

function execQuery(connectionString, sql, params, cb) {
  pg.connect(connectionString, (err, client, done) => {
    let query = client.query(
      sql,
      params,
    (err, result) => {
      if(err) {
        console.log("Error executing query: ", sql, params);
        return;
      }

      done();
      (cb || noop)(result.rowCount);
    });
  });
}

function queryRows(connectionString, sql, params, cb) {
  pg.connect(connectionString, (err, client, done) => {
    let query = client.query(
      sql,
      params,
    (err, result) => {
      if(err) {
        console.log("Error executing query: ", sql, params);
        return;
      }

      done();
      (cb || noop)(result.rows);
    });
  });
}

function insertImage(connectionString, image, cb) {
  queryRows(connectionString,
    "INSERT INTO images (filename, thumbnail_filename, original_filename)" +
    " VALUES ($1, $2, $3)" +
    " RETURNING id;",
    [image.filename, image.thumbnailFilename, image.originalFilename],
    cb);
}

function insertPost(connectionString, roomName, post, imageId, cb) {
  queryRows(connectionString,
    "INSERT INTO posts (room_id, posted, name, comment, image_id, ip)" +
    " SELECT (SELECT id FROM rooms WHERE name = $1), $2, $3, $4, $5, $6" +
    " RETURNING id;",
    [roomName, post.posted, post.name, post.comment, imageId, post.ip],
    cb);
}

class AriaStore {
  constructor(connectionString) {
    this.connectionString = process.env.DATABASE_URL || connectionString || "postgres://aria:aria@localhost:5432/aria";
  }

  getRoom(roomName, cb) {
    queryRows(this.connectionString,
      "SELECT id, name, content_url, password, expires" +
      " FROM rooms" +
      " WHERE name = $1;",
      [roomName],
      cb);
  }

  claimRoom(roomName, cb) {
    execQuery(this.connectionString,
      "INSERT INTO rooms (name, content_url, password, claimed, expires)" +
      " SELECT $1, $2, $3, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC' + INTERVAL '1 day'" +
      " WHERE NOT EXISTS (SELECT * FROM rooms WHERE name = $1 AND expires > NOW() AT TIME ZONE 'UTC')" +
      " RETURNING name, password;",
      [roomName, "about:blank", "123"],
      cb);
  }

  getPosts(roomName, options, cb) {
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

    queryRows(this.connectionString,
      sql,
      [roomName],
      (rows) => {
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

        // Return posts
        (cb || noop)(posts);
      });
  }

  addPost(roomName, post, cb) {
    if (post.image) {
      // Post contained an image - insert image record first
      insertImage(this.connectionString, post.image, (images) => {
        let imageId = images[0].id;

        // Insert post record linked to the inserted image
        insertPost(this.connectionString, roomName, post, imageId, () => {
          (cb || noop)(true);
        });
      })
    }
    else {
      // No image - insert post without image link
      insertPost(this.connectionString, roomName, post, null, () => {
        (cb || noop)(true);
      });
    }
  }
}

function postgresql(connectionString) {
  return new AriaStore(connectionString);
}

module.exports = {
  postgresql: postgresql
};
