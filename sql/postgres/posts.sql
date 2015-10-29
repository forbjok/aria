-- Table: posts

-- DROP TABLE posts;

CREATE TABLE posts
(
  id serial NOT NULL,
  room_id integer NOT NULL,
  posted timestamp without time zone NOT NULL,
  name text NOT NULL,
  comment text NOT NULL,
  image_id integer,
  ip inet NOT NULL,
  CONSTRAINT posts_pkey PRIMARY KEY (id),
  CONSTRAINT posts_image_id_fkey FOREIGN KEY (image_id)
      REFERENCES images (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT posts_room_id_fkey FOREIGN KEY (room_id)
      REFERENCES rooms (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
  OIDS=FALSE
);
ALTER TABLE posts
  OWNER TO aria;

-- Index: posts_image_id_idx

-- DROP INDEX posts_image_id_idx;

CREATE INDEX posts_image_id_idx
  ON posts
  USING btree
  (image_id);

-- Index: posts_room_id_idx

-- DROP INDEX posts_room_id_idx;

CREATE INDEX posts_room_id_idx
  ON posts
  USING btree
  (room_id);
