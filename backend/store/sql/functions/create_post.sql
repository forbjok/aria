CREATE FUNCTION create_post(
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
