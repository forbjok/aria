-- Add new columns to image table
ALTER TABLE image
  ADD COLUMN hash text;

ALTER TABLE image
  ADD COLUMN ext text;

ALTER TABLE image
  ADD COLUMN tn_ext text;

-- Update create_post function to use new columns
DROP FUNCTION IF EXISTS create_post;
DROP TYPE IF EXISTS new_image;

CREATE TYPE new_image AS (filename text, size bigint, width integer, height integer, hash text, ext text, tn_ext text);

-- Create create_post function
CREATE OR REPLACE FUNCTION create_post(
  IN p_room_name text,
  IN p_post new_post,
  IN p_image new_image
)
RETURNS bigint
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_room_id integer;
  v_post_id bigint;
  v_image_id bigint;
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
  RETURNING id INTO v_post_id;
	
  -- If an image is provided, insert it
  IF NOT p_image IS NULL THEN
    INSERT INTO image (
      post_id,
      filename,
      size,
      width,
      height,
      content_type,
      tn_content_type,
      path,
      tn_path,
      hash,
      ext,
      tn_ext
    )
    SELECT
      v_post_id, -- post_id
      p_image.filename, -- filename
      p_image.size, -- size
      p_image.width, -- width
      p_image.height, -- height
      '', -- content_type
      '', -- tn_content_type
      '', -- path
      '', -- tn_path
      p_image.hash, -- hash
      p_image.ext, -- ext
      p_image.tn_ext -- tn_ext
    RETURNING id INTO v_image_id;
  END IF;

  RETURN v_post_id;
END;
$BODY$;
