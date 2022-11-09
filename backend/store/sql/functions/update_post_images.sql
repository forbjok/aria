CREATE FUNCTION update_post_images(
  IN p_hash text,
  IN p_ext text,
  IN p_tn_ext text
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
BEGIN
  UPDATE image
  SET ext = p_ext, tn_ext = p_tn_ext
  WHERE hash = p_hash;
END;
$BODY$;
