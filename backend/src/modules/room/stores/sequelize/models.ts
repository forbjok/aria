import { DataTypes, InferAttributes, InferCreationAttributes, Model, ModelStatic, Sequelize } from "sequelize";


export class RoomModel extends Model<InferAttributes<RoomModel>, InferCreationAttributes<RoomModel>> {
  declare id?: number;
  declare name?: string;
  declare content_url?: string;
  declare password?: string;
  declare claimed?: Date;
  declare expires?: Date;
}

export interface RoomModels {
  Room: ModelStatic<RoomModel>;
}

export function createModels(sequelize: Sequelize): RoomModels {
  let Room = sequelize.define("rooms", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: DataTypes.STRING(50),
    content_url: DataTypes.STRING(2000),
    password: DataTypes.STRING(6),
    claimed: DataTypes.DATE,
    expires: DataTypes.DATE
  });

  return {
    Room: Room
  };
}
