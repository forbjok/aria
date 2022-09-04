-- Create emote table
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

-- Create types
CREATE TYPE new_emote AS (name text, hash text, ext text);

-- Create create_emote function
CREATE OR REPLACE FUNCTION create_emote(
  IN p_room_name text,
  IN p_emote new_emote
)
RETURNS SETOF emote
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_room_id integer;
BEGIN
  SELECT id INTO v_room_id FROM get_room_by_name(p_room_name);

  -- Insert emote
  RETURN QUERY
  INSERT INTO emote (
    room_id,
    name,
    hash,
    ext
  )
  SELECT
    v_room_id, -- room_id
    p_emote.name, -- name
    p_emote.hash, -- hash
    p_emote.ext -- ext
  ON CONFLICT (room_id, name) DO UPDATE SET hash = p_emote.hash, ext = p_emote.ext
  RETURNING *;
END;
$BODY$;
