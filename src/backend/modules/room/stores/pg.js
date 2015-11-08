"use strict";

let Promise = require("bluebird");
let pg = require("pg");
let randomstring = require("randomstring");

function generatePassword() {
  return randomstring.generate({
    length: 6,
    readable: true
  });
}

class PgRoomStore {
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

  getRoom(roomName) {
    return this._queryRows(
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
    return this._queryRows(
      "INSERT INTO rooms (name, content_url, password, claimed, expires)" +
      " SELECT $1, $2, $3, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC' + INTERVAL '1 day'" +
      " WHERE NOT EXISTS (SELECT * FROM rooms WHERE name = $1 AND expires > NOW() AT TIME ZONE 'UTC')" +
      " RETURNING name, password;",
      [roomName, "about:blank", generatePassword()]).then((rows) => {
        if (!rows || rows.length === 0) {
          return;
        }

        return rows[0];
      });
  }

  setContentUrl(roomName, contentUrl) {
    return this._execQuery(
      "UPDATE rooms" +
      " SET content_url = $2" +
      " WHERE name = $1;",
      [roomName, contentUrl])
      .then((rowsAffected) => {
        return rowsAffected === 1;
      });
  }
}

function create(connectionString) {
  return new PgRoomStore(connectionString);
}

module.exports = {
  create: create
};
