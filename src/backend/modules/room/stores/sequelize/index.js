"use strict";

let Sequelize = require("sequelize");
let moment = require("moment");
let randomstring = require("randomstring");

let models = require("./models");

function generatePassword() {
  return randomstring.generate({
    length: 6,
    readable: true
  });
}

class SequelizeRoomStore {
  constructor(connectionString, options) {
    Object.assign(this, {
      schema: "room"
    }, options);

    this.connectionString = connectionString;

    this.sequelize = new Sequelize(this.connectionString, {
      define: {
        timestamps: false,
        schema: this.schema
      }
    });

    this.models = models(this.sequelize);
    this.sequelize.createSchema(this.schema)
    .catch(() => {})
    .finally(() => {
      this.sequelize.sync();
    });
  }

  getRoom(roomName) {
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

  claimRoom(roomName) {
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

  setContentUrl(roomName, contentUrl) {
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

function create(connectionString, options) {
  return new SequelizeRoomStore(connectionString, options);
}

module.exports = {
  create: create
};
