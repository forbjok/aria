-- Drop columns
ALTER TABLE image
  DROP COLUMN size;

ALTER TABLE image
  DROP COLUMN width;

ALTER TABLE image
  DROP COLUMN height;

-- Drop create_post function because it depends on new_image type
DROP FUNCTION IF EXISTS create_post;

-- Update new_image type
DROP TYPE IF EXISTS new_image;

CREATE TYPE new_image AS (filename text, hash text, ext text, tn_ext text);

-- Update create_post function
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
