import { Sequelize } from "sequelize";
import * as moment from "moment";
import * as randomstring from "randomstring";

import * as models from "./models";
import { IRoomStore, RoomInfo } from "../../roomstore";

interface NewRoomInfo {
  name: string;
  password: string;
}

function generatePassword() {
  return randomstring.generate({
    length: 6,
    readable: true
  });
}

export interface SequelizeRoomStoreOptions {
  schema?: string;
}

export class SequelizeRoomStore implements IRoomStore {
  sequelize: Sequelize;
  models: models.RoomModels;
  schema: string;
  
  constructor(public connectionString: string, options: SequelizeRoomStoreOptions) {
    Object.assign(this, {
      schema: "room"
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

  async getRoom(roomName: string): Promise<RoomInfo> {
    let room = await this.models.Room.findOne({
      where: {
        name: roomName
      }
    });

    if (!room) {
      // Room was not found - return nothing
      return;
    }

    // Room was found, return it
    return {
      name: room.name,
      contentUrl: room.content_url,
      password: room.password,
      claimed: room.claimed,
      expires: room.expires,
    };
  }

  async claimRoom(roomName: string): Promise<NewRoomInfo> {
    let claimed = moment();
    let expires = moment().add(1, "day");

    let room = await this.models.Room.create({
      name: roomName,
      content_url: "about:blank",
      password: generatePassword(),
      claimed: claimed.toDate(),
      expires: expires.toDate(),
    });

    return {
      name: room.name,
      password: room.password,
    };
  }

  async setContentUrl(roomName: string, contentUrl: string): Promise<number> {
    let room = await this.models.Room.findOne({
      where: {
        name: roomName,
      }
    });

    await room.update({
      content_url: contentUrl,
    });

    return 1;
  }
}

export function create(connectionString: string, options: SequelizeRoomStoreOptions) {
  return new SequelizeRoomStore(connectionString, options);
}
