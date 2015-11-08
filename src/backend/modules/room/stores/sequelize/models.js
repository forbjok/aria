"use strict";

let Sequelize = require("sequelize");

function createModels(sequelize) {
  let Room = sequelize.define("rooms", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: Sequelize.STRING(50),
    content_url: Sequelize.STRING(2000),
    password: Sequelize.STRING(6),
    claimed: Sequelize.DATE,
    expires: Sequelize.DATE
  });

  return {
    Room: Room
  };
}

module.exports = createModels;
