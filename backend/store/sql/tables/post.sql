CREATE TABLE post
(
  id bigserial NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  room_id integer NOT NULL,
  name text,
  comment text,
  ip inet NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  user_id bigint NOT NULL,
  admin boolean NOT NULL DEFAULT false,

  PRIMARY KEY (id),

  FOREIGN KEY (room_id)
    REFERENCES room (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE
    NOT VALID
);

SELECT manage_updated_at('post'); -- Automatically manage updated_at

CREATE INDEX post_room_id_idx ON post
  USING btree
  (room_id ASC NULLS LAST);
