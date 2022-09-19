-- Create functions for automatically managing updated_at
CREATE OR REPLACE FUNCTION manage_updated_at(_tbl regclass)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
BEGIN
  EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %s
          FOR EACH ROW EXECUTE FUNCTION set_updated_at()', _tbl);
END;
$BODY$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql

AS $BODY$
BEGIN
  IF (NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at) THEN
    NEW.updated_at := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$BODY$;

-- Create room table
CREATE TABLE room
(
  id serial NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  name text NOT NULL,
  claimed_at timestamp with time zone NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  password text NOT NULL,
  content json,
  PRIMARY KEY (id),
  UNIQUE (name)
);

SELECT manage_updated_at('room'); -- Automatically manage updated_at

-- Create post table
CREATE TABLE post
(
  id bigserial NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  room_id integer NOT NULL,
  name text,
  comment text,
  ip inet NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (room_id)
    REFERENCES room (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE
    NOT VALID
);

SELECT manage_updated_at('post'); -- Automatically manage updated_at

-- Create image table
CREATE TABLE image
(
  id bigserial NOT NULL,
  post_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  filename text NOT NULL,
  hash text NOT NULL,
  ext text NOT NULL,
  tn_ext text NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (post_id)
    REFERENCES post (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE
    NOT VALID,
  UNIQUE (post_id)
);

SELECT manage_updated_at('image'); -- Automatically manage updated_at

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

SELECT manage_updated_at('emote'); -- Automatically manage updated_at

-- Create types
CREATE TYPE new_post AS (name text, comment text, ip inet);
CREATE TYPE new_image AS (filename text, hash text, ext text, tn_ext text);
CREATE TYPE new_emote AS (name text, hash text, ext text);

-- Create get_room_by_name function
CREATE OR REPLACE FUNCTION get_room_by_name(IN p_room_name text)
RETURNS SETOF room
LANGUAGE sql

AS $BODY$
SELECT * FROM room WHERE name = p_room_name LIMIT 1;
$BODY$;

-- Create create_room function
CREATE OR REPLACE FUNCTION create_room(
  IN p_name text,
  IN p_password text
)
RETURNS SETOF room
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_room_id integer;
BEGIN
  SELECT id INTO v_room_id FROM get_room_by_name(p_name);
  IF v_room_id IS NOT NULL THEN
    RAISE EXCEPTION 'Room already exists.';
  END IF;

  -- Insert post
  RETURN QUERY
  INSERT INTO room (
    name,
		claimed_at,
		expires_at,
    password
  )
  SELECT
    p_name, -- name
		CURRENT_TIMESTAMP, -- claimed_at
		to_timestamp('9999-12-31', 'YYYY-MM-DD'), -- expires_at
    p_password -- password
  RETURNING *;
END;
$BODY$;

-- Create get_posts function
CREATE OR REPLACE FUNCTION get_posts(IN p_room_name text)
RETURNS TABLE (post post, image image)
LANGUAGE sql

AS $BODY$
SELECT p AS post, i AS image
FROM post AS p
INNER JOIN room AS r ON r.id = p.room_id
LEFT JOIN image AS i ON i.post_id = p.id
WHERE r.name = p_room_name
$BODY$;

-- Create create_post function
CREATE OR REPLACE FUNCTION create_post(
  IN p_room_name text,
  IN p_post new_post,
  IN p_image new_image
)
RETURNS TABLE (post post, image image)
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_room_id integer;
  v_post post;
  v_image image;
BEGIN
  SELECT id INTO v_room_id FROM get_room_by_name(p_room_name);

  -- Insert post
  INSERT INTO post (
    room_id,
    name,
    comment,
    ip
  )
  SELECT
    v_room_id, -- room_id
    p_post.name, -- name
    p_post.comment, -- comment
    p_post.ip -- ip
  RETURNING * INTO v_post;

  -- If an image is provided, insert it
  IF NOT p_image IS NULL THEN
    INSERT INTO image (
      post_id,
      filename,
      hash,
      ext,
      tn_ext
    )
    SELECT
      v_post.id, -- post_id
      p_image.filename, -- filename
      p_image.hash, -- hash
      p_image.ext, -- ext
      p_image.tn_ext -- tn_ext
    RETURNING * INTO v_image;
  END IF;

  RETURN QUERY SELECT v_post AS post, v_image AS image;
END;
$BODY$;

-- Create set_room_content function
CREATE OR REPLACE FUNCTION set_room_content(
  IN p_room_name text,
  IN p_content json
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_room_id integer;
BEGIN
  SELECT id INTO v_room_id FROM get_room_by_name(p_room_name);

  UPDATE room
  SET content = p_content
  WHERE id = v_room_id;
END;
$BODY$;

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
