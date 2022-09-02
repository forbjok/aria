import { Client, QueryResultRow } from "pg";
import { migrate } from "postgres-migrations";
import { Content, IAriaStore, Post, RoomInfo } from ".";
import { generatePassword } from "../util/passwordgen";

interface RoomModel {
  id: number;
  name: string;
  password: string;
  content: Content;
}

interface PostModel {
  id: number;
  created_at: string;
  name?: string;
  comment?: string;
  ip: string;

  filename?: string;
  hash?: string;
  ext?: string;
  tn_ext?: string;
}

export interface ImageModel {
  id: number;
  path: string;
  tn_path: string;
  hash: string;
  ext: string;
  tn_ext: string;
}

interface NewPost {
  name?: string;
  comment?: string;
  ip: string;
}

interface NewImage {
  filename: string;
  size: number;
  width: number;
  height: number;
  hash: string;
  ext: string;
  tn_ext: string;
}

export class PgAriaStore implements IAriaStore {
  private readonly client: Client;
  private readonly connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = process.env.DATABASE_URL || connectionString || "postgres://aria:aria@localhost:5432/aria";
    this.client = new Client(this.connectionString);
  }

  async connect() {
    await this.client.connect();
  }

  async migrate() {
    await migrate({ client: this.client }, "../migrations");
  }

  async getRoom(roomName: string): Promise<RoomInfo | null> {
    const rows = await this.queryRows<RoomModel>("SELECT name, password, content FROM get_room_by_name($1);", [
      roomName,
    ]);

    if (!rows || rows.length === 0) {
      return null;
    }

    const r = rows[0];

    return {
      name: r.name,
      password: r.password,
      content: r.content,
    };
  }

  async createRoom(roomName: string): Promise<RoomInfo | null> {
    const password = generatePassword();
    const rows = await this.queryRows<RoomModel>("SELECT * FROM create_room($1, $2);", [roomName, password]);

    if (!rows || rows.length === 0) {
      return null;
    }

    const r = rows[0];

    return {
      name: r.name,
      password: r.password,
      content: r.content,
    };
  }

  async getPosts(roomName: string, options: any): Promise<Post[]> {
    options = options || {};

    let limit = "";
    if (options.limit) limit = ` LIMIT ${options.limit}`;

    const sql =
      "SELECT p2.* FROM (" +
      " SELECT (p.p).id, (p.p).created_at, (p.p).name, (p.p).comment," +
      "  (p.i).filename, (p.i).hash, (p.i).ext, (p.i).tn_ext" +
      " FROM get_posts($1) AS p" +
      " ORDER BY (p.p).id DESC" +
      limit +
      ") AS p2 ORDER BY p2.id ASC;";

    const rows = await this.queryRows<PostModel>(sql, [roomName]);

    // Transform raw DB rows into valid internal post objects
    const posts: Post[] = [];
    for (const row of rows) {
      const post: Post = {
        id: row.id,
        postedAt: row.created_at,
        name: row.name,
        comment: row.comment,
        ip: row.ip,
      };

      if (row.filename) {
        post.image = {
          filename: row.filename,
          hash: row.hash || "",
          ext: row.ext || "",
          tnExt: row.tn_ext || "",
        };
      }

      posts.push(post);
    }

    return posts;
  }

  async addPost(roomName: string, post: Post): Promise<Post | null> {
    const newPost: NewPost = {
      name: post.name,
      comment: post.comment,
      ip: post.ip,
    };

    let image: NewImage | null = null;

    if (post.image != null) {
      const i = post.image;

      image = {
        filename: i.filename,
        size: -1,
        width: -1,
        height: -1,
        hash: i.hash,
        ext: i.ext,
        tn_ext: i.tnExt,
      };
    }

    // Create post
    const rows = await this.queryRows<PostModel>(
      "SELECT * FROM create_post($1, " +
        "jsonb_populate_record(NULL::new_post, $2), " +
        "jsonb_populate_record(NULL::new_image, $3));",
      [roomName, newPost, image]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const r = rows[0];

    return {
      id: r.id,
      name: r.name,
      comment: r.comment,
      postedAt: r.created_at,
      ip: r.ip,
    };
  }

  async setContent(roomName: string, content: Content): Promise<number> {
    const rowsAffected = await this.execQuery("SELECT set_room_content($1, $2);", [roomName, content]);

    return rowsAffected;
  }

  async getAllImages(): Promise<ImageModel[]> {
    const sql = "SELECT * FROM image;";

    const images = await this.queryRows<ImageModel>(sql, []);

    return images;
  }

  async updateImage(image: ImageModel): Promise<boolean> {
    const sql = "UPDATE image SET hash = $2, ext = $3, tn_ext = $4 WHERE id = $1;";

    const rowsAffected = await this.execQuery(sql, [image.id, image.hash, image.ext, image.tn_ext]);

    return rowsAffected > 0;
  }

  private async execQuery(sql: string, params: any): Promise<number> {
    const result = await this.client.query(sql, params);

    return result.rowCount;
  }

  private async queryRows<R extends QueryResultRow>(sql: string, params: any): Promise<R[]> {
    const result = await this.client.query<R>(sql, params);

    return result.rows;
  }
}
