import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, ModelStatic, Optional, Sequelize } from "sequelize";

export class RoomModel extends Model<InferAttributes<RoomModel>, InferCreationAttributes<RoomModel>> {
  declare id: CreationOptional<number>;
  declare name: string;
}

export class ImageModel extends Model<InferAttributes<ImageModel>, InferCreationAttributes<ImageModel>> {
  declare id: CreationOptional<number>;
  declare filename: string;
  declare thumbnail_filename: string;
  declare original_filename: string;
}

export class PostModel extends Model<InferAttributes<PostModel>, InferCreationAttributes<PostModel>> {
  declare id: CreationOptional<number>;
  declare room_id: number;
  declare posted: CreationOptional<string>;
  declare name: string;
  declare comment: string;
  declare image_id?: number;
  declare ip: string;

  room?: RoomModel;
  image?: ImageModel;
}

export interface ChatModels {
  Room: ModelStatic<RoomModel>;
  Image: ModelStatic<ImageModel>;
  Post: ModelStatic<PostModel>;
}

export function createModels(sequelize: Sequelize): ChatModels {
  let Room = sequelize.define("rooms", {
    id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(50), allowNull: false }
  });

  let Image = sequelize.define<ImageModel>("images", {
    id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    filename: { type: DataTypes.STRING(100), allowNull: false },
    thumbnail_filename: { type: DataTypes.STRING(100), allowNull: false },
    original_filename: { type: DataTypes.STRING(255), allowNull: false }
  });

  let Post = sequelize.define<PostModel>("posts", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    room_id: { type: DataTypes.INTEGER, allowNull: false },
    posted: { type: DataTypes.DATE, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    comment: { type: DataTypes.TEXT, allowNull: false },
    image_id: { type: DataTypes.INTEGER, allowNull: true },
    ip: { type: DataTypes.STRING(64), allowNull: false }
  });

  Post.belongsTo(Room, { as: "room", foreignKey: "room_id", onDelete: "CASCADE" });
  Post.belongsTo(Image, { as: "image", foreignKey: "image_id", onDelete: "SET NULL" });

  return {
    Room: <ModelStatic<RoomModel>> Room,
    Image: Image,
    Post: Post
  };
}
