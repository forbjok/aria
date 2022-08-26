import * as pg from "pg";
import * as randomstring from "randomstring";
import { IRoomStore, NewRoomInfo, RoomInfo } from "../roomstore";

function generatePassword() {
  return randomstring.generate({
    length: 6,
    readable: true
  });
}

class PgRoomStore implements IRoomStore {
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

  getRoom(roomName: string): PromiseLike<RoomInfo> {
    return this._queryRows(
      "SELECT name, content_url, password, claimed, expires" +
      " FROM room.rooms" +
      " WHERE name = $1;",
      [roomName])
      .then((rows) => {
        if (!rows || rows.length === 0) {
          return;
        }

        let row = rows[0];
        let room: RoomInfo = {
          name: row.name,
          contentUrl: row.content_url,
          password: row.password,
          claimed: row.claimed,
          expires: row.expires,
        };

        return room;
      });
  }

  claimRoom(roomName: string): PromiseLike<NewRoomInfo> {
    return this._queryRows(
      "INSERT INTO room.rooms (name, content_url, password, claimed, expires)" +
      " SELECT $2, $3, $4, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC' + INTERVAL '1 day'" +
      " WHERE NOT EXISTS (SELECT * FROM room.rooms WHERE name = $1 AND expires > NOW() AT TIME ZONE 'UTC')" +
      " RETURNING name, password;",
      
      /* We need to pass the same parameter twice to avoid 
         "inconsistent types deduced for parameter" errors */
      [roomName, roomName, "about:blank", generatePassword()]).then((rows) => {
        if (!rows || rows.length === 0) {
          return;
        }

        return rows[0];
      });
  }

  setContentUrl(roomName: string, contentUrl: string): PromiseLike<number> {
    return this._execQuery(
      "UPDATE room.rooms" +
      " SET content_url = $2" +
      " WHERE name = $1;",
      [roomName, contentUrl])
      .then((rowsAffected) => {
        return rowsAffected;
      });
  }
}

export function create(connectionString: string) {
  return new PgRoomStore(connectionString);
}
