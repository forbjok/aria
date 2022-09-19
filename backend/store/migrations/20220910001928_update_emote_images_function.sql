-- Create update_emote_images function
CREATE OR REPLACE FUNCTION update_emote_images(
  IN p_hash text,
  IN p_ext text
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
BEGIN
  UPDATE emote
  SET ext = p_ext
  WHERE hash = p_hash;
END;
$BODY$;
