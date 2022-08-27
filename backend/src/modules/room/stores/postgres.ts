import { Client } from "pg";
import * as randomstring from "randomstring";
import { IRoomStore, NewRoomInfo, RoomInfo } from "../roomstore";

function generatePassword() {
  return randomstring.generate({
    length: 6,
    readable: true
  });
}

class PgRoomStore implements IRoomStore {
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

  async getRoom(roomName: string): Promise<RoomInfo> {
    const rows = await this._queryRows(
      "SELECT name, content_url, password, claimed, expires" +
      " FROM room.rooms" +
      " WHERE name = $1;",
      [roomName]);

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
  }

  async claimRoom(roomName: string): Promise<NewRoomInfo> {
    const rows = await this._queryRows(
      "INSERT INTO room.rooms (name, content_url, password, claimed, expires)" +
      " SELECT $2, $3, $4, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC' + INTERVAL '1 day'" +
      " WHERE NOT EXISTS (SELECT * FROM room.rooms WHERE name = $1 AND expires > NOW() AT TIME ZONE 'UTC')" +
      " RETURNING name, password;",
      
      /* We need to pass the same parameter twice to avoid 
         "inconsistent types deduced for parameter" errors */
      [roomName, roomName, "about:blank", generatePassword()]);

    if (!rows || rows.length === 0) {
      return;
    }

    return rows[0];
  }

  async setContentUrl(roomName: string, contentUrl: string): Promise<number> {
    const rowsAffected = await this._execQuery(
      "UPDATE room.rooms" +
      " SET content_url = $2" +
      " WHERE name = $1;",
      [roomName, contentUrl]);

    return rowsAffected;
  }
}

export function create(connectionString: string) {
  return new PgRoomStore(connectionString);
}
