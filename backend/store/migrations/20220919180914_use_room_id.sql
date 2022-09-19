-- Drop old functions
DROP FUNCTION create_post;
DROP FUNCTION delete_post;
DROP FUNCTION get_recent_posts;
DROP FUNCTION set_room_content;
DROP FUNCTION create_emote;
DROP FUNCTION delete_emote;
DROP FUNCTION get_emotes;

-- Update create_post function
CREATE OR REPLACE FUNCTION create_post(
  IN p_room_id integer,
  IN p_post new_post,
  IN p_image new_image
)
RETURNS TABLE (post post, image image)
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_post post;
  v_image image;
BEGIN
  -- Insert post
  INSERT INTO post (
    room_id,
    name,
    comment,
    ip
  )
  SELECT
    p_room_id, -- room_id
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

-- Update delete_post function
CREATE OR REPLACE FUNCTION delete_post(
  IN p_room_id integer,
  IN p_post_id bigint
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
BEGIN
  UPDATE post
  SET is_deleted = true
  WHERE room_id = p_room_id AND id = p_post_id;
END;
$BODY$;

-- Update get_recent_posts function
CREATE OR REPLACE FUNCTION get_recent_posts(IN p_room_id integer, IN p_count integer)
RETURNS TABLE (post post, image image)
LANGUAGE plpgsql

AS $BODY$
BEGIN
  RETURN QUERY
  SELECT p AS post, i AS image
  FROM post AS p
  LEFT JOIN image AS i ON i.post_id = p.id
  WHERE p.room_id = p_room_id AND NOT p.is_deleted
  ORDER BY p.id DESC
  LIMIT p_count;
END;
$BODY$;

-- Update set_room_content function
CREATE OR REPLACE FUNCTION set_room_content(
  IN p_room_id integer,
  IN p_content json
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
BEGIN
  UPDATE room
  SET content = p_content
  WHERE id = p_room_id;
END;
$BODY$;

-- Create create_emote function
CREATE OR REPLACE FUNCTION create_emote(
  IN p_room_id integer,
  IN p_emote new_emote
)
RETURNS SETOF emote
LANGUAGE plpgsql

AS $BODY$
BEGIN
  -- Insert emote
  RETURN QUERY
  INSERT INTO emote (
    room_id,
    name,
    hash,
    ext
  )
  SELECT
    p_room_id, -- room_id
    p_emote.name, -- name
    p_emote.hash, -- hash
    p_emote.ext -- ext
  ON CONFLICT (room_id, name) DO UPDATE SET hash = p_emote.hash, ext = p_emote.ext
  RETURNING *;
END;
$BODY$;

-- Update delete_emote function
CREATE OR REPLACE FUNCTION delete_emote(
  IN p_room_id integer,
  IN p_emote_id integer
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
BEGIN
  DELETE FROM emote AS e
  WHERE e.room_id = p_room_id AND e.id = p_emote_id;
END;
$BODY$;

-- Update get_emotes function
CREATE OR REPLACE FUNCTION get_emotes(IN p_room_id integer)
RETURNS SETOF emote
LANGUAGE plpgsql

AS $BODY$
BEGIN
  RETURN QUERY
  SELECT e.*
  FROM emote AS e
  WHERE e.room_id = p_room_id;
END;
$BODY$;
