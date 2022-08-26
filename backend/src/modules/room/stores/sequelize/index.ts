import { Sequelize } from "sequelize";
import * as moment from "moment";
import * as randomstring from "randomstring";

import * as models from "./models";

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

export class SequelizeRoomStore implements IRoomStore {
  sequelize: Sequelize;
  models: models.RoomModels;
  schema: string;
  
  constructor(public connectionString: string, options: any) {
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

  getRoom(roomName: string): PromiseLike<RoomInfo> {
    return this.models.Room.findOne({
      where: {
        name: roomName
      }
    }).then((room) => {
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
        expires: room.expires
      };
    });
  }

  claimRoom(roomName: string): PromiseLike<NewRoomInfo> {
    let claimed = moment();
    let expires = moment().add(1, "day");

    return this.models.Room.create({
      name: roomName,
      content_url: "about:blank",
      password: generatePassword(),
      claimed: claimed.toDate(),
      expires: expires.toDate()
    })
    .then((room) => {
      return {
        name: room.name,
        password: room.password
      };
    });
  }

  setContentUrl(roomName: string, contentUrl: string): PromiseLike<number> {
    return this.models.Room.findOne({
      where: {
        name: roomName
      }
    }).then((room) => {
      return room.update({
        content_url: contentUrl
      }).then(() => {
        return 1;
      });
    });
  }
}

export function create(connectionString: string, options: any) {
  return new SequelizeRoomStore(connectionString, options);
}
