-- Add password column to post table
ALTER TABLE post
  ADD COLUMN password text;

-- Drop old functions
DROP FUNCTION create_post;
DROP FUNCTION delete_post;

-- Update new_post type
DROP TYPE new_post;
CREATE TYPE new_post AS (name text, comment text, ip inet, password text);

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
    ip,
    password
  )
  SELECT
    p_room_id, -- room_id
    p_post.name, -- name
    p_post.comment, -- comment
    p_post.ip, -- ip
    p_post.password -- password
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
  IN p_post_id bigint,
  IN p_is_admin boolean,
  IN p_password text
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
BEGIN
  IF p_is_admin THEN
    UPDATE post
    SET is_deleted = true
    WHERE room_id = p_room_id AND id = p_post_id;
  ELSE
    UPDATE post
    SET is_deleted = true
    WHERE room_id = p_room_id AND id = p_post_id AND password = p_password;
  END IF;
END;
$BODY$;
