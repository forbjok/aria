import * as Sequelize from "sequelize";

export interface RoomAttributes {
  id?: number;
  name?: string;
}

export interface ImageAttributes {
  id?: number;
  filename?: string;
  thumbnail_filename?: string;
  original_filename?: string;
}

export interface PostAttributes {
  id?: number;
  room_id?: number;
  posted?: string;
  name?: string;
  comment?: string;
  image_id?: number;
  ip?: string;
}

export interface RoomInstance extends Sequelize.Instance<RoomAttributes>, RoomAttributes {}
export interface ImageInstance extends Sequelize.Instance<ImageAttributes>, ImageAttributes {}
export interface PostInstance extends Sequelize.Instance<PostAttributes>, PostAttributes {
  room: RoomInstance;
  image: ImageInstance;
  /*getRoom: Sequelize.BelongsToGetAssociationMixin<RoomInstance>;
  setRoom: Sequelize.BelongsToSetAssociationMixin<RoomInstance, string>;
  getImage: Sequelize.BelongsToGetAssociationMixin<ImageInstance>;
  setImage: Sequelize.BelongsToSetAssociationMixin<ImageInstance, string>;*/
}

export interface RoomModel extends Sequelize.Model<RoomInstance, RoomAttributes> {}
export interface ImageModel extends Sequelize.Model<ImageInstance, ImageAttributes> {}
export interface PostModel extends Sequelize.Model<PostInstance, PostAttributes> {}

export interface ChatModels {
  Room: RoomModel;
  Image: ImageModel;
  Post: PostModel;
}

export function createModels(sequelize: Sequelize.Sequelize): ChatModels {
  let Room = sequelize.define<RoomInstance, RoomAttributes>("rooms", {
    id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    name: { type: Sequelize.STRING(50), allowNull: false }
  });

  let Image = sequelize.define<ImageInstance, ImageAttributes>("images", {
    id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    filename: { type: Sequelize.STRING(100), allowNull: false },
    thumbnail_filename: { type: Sequelize.STRING(100), allowNull: false },
    original_filename: { type: Sequelize.STRING(255), allowNull: false }
  });

  let Post = sequelize.define<PostInstance, PostAttributes>("posts", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    room_id: { type: Sequelize.INTEGER, allowNull: false },
    posted: { type: Sequelize.DATE, allowNull: false },
    name: { type: Sequelize.STRING(100), allowNull: false },
    comment: { type: Sequelize.TEXT, allowNull: false },
    image_id: { type: Sequelize.INTEGER, allowNull: true },
    ip: { type: Sequelize.STRING(64), allowNull: false }
  });

  Post.belongsTo(Room, { as: "room", foreignKey: "room_id", onDelete: "CASCADE" });
  Post.belongsTo(Image, { as: "image", foreignKey: "image_id", onDelete: "SET NULL" });

  return {
    Room: Room,
    Image: Image,
    Post: Post
  };
}
