import * as Sequelize from "sequelize";

export interface RoomAttributes {
  id?: number;
  name?: string;
  content_url?: string;
  password?: string;
  claimed?: Date;
  expires?: Date;
}

export interface RoomInstance extends Sequelize.Instance<RoomAttributes>, RoomAttributes {}

export interface RoomModel extends Sequelize.Model<RoomInstance, RoomAttributes> {}

export interface RoomModels {
  Room: RoomModel;
}

export function createModels(sequelize: Sequelize.Sequelize): RoomModels {
  let Room = sequelize.define<RoomInstance, RoomAttributes>("rooms", {
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
