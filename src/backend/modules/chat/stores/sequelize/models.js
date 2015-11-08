"use strict";

let Sequelize = require("sequelize");

function createModels(sequelize) {
  let Room = sequelize.define("rooms", {
    id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    name: { type: Sequelize.STRING(50), allowNull: false }
  });

  let Image = sequelize.define("images", {
    id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    filename: { type: Sequelize.STRING(100), allowNull: false },
    thumbnail_filename: { type: Sequelize.STRING(100), allowNull: false },
    original_filename: { type: Sequelize.STRING(255), allowNull: false }
  });

  let Post = sequelize.define("posts", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    room_id: { type: Sequelize.INTEGER, allowNull: false },
    posted: { type: Sequelize.DATE, allowNull: false },
    name: { type: Sequelize.STRING(100), allowNull: false },
    comment: { type: Sequelize.TEXT, allowNull: false },
    image_id: { type: Sequelize.INTEGER, allowNull: true },
    ip: { type: Sequelize.STRING(16), allowNull: false }
  });

  Post.belongsTo(Room, { as: "room", foreignKey: "room_id" });
  Post.hasOne(Image, { as: "image", foreignKey: "image_id" });

  return {
    Room: Room,
    Image: Image,
    Post: Post
  };
}

module.exports = createModels;
