-- Add admin column to post table
ALTER TABLE post
  ADD COLUMN admin boolean NOT NULL DEFAULT false;

-- Drop old functions
DROP FUNCTION create_post;

-- Update new_post type
DROP TYPE new_post;
CREATE TYPE new_post AS (name text, comment text, ip inet, user_id bigint, admin boolean);

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
    user_id,
    admin
  )
  SELECT
    p_room_id, -- room_id
    p_post.name, -- name
    p_post.comment, -- comment
    p_post.ip, -- ip
    p_post.user_id, -- user_id
    p_post.admin -- admin
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
