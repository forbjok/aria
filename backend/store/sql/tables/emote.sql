CREATE TABLE emote
(
  id serial NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  room_id integer NOT NULL,
  name text,
  hash text NOT NULL,
  ext text NOT NULL,

  PRIMARY KEY (id),

  FOREIGN KEY (room_id)
    REFERENCES room (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE
    NOT VALID,

  UNIQUE (room_id, name)
);

SELECT manage_updated_at('emote'); -- Automatically manage updated_at

CREATE INDEX emote_room_id_idx ON emote
  USING btree
  (room_id ASC NULLS LAST);
