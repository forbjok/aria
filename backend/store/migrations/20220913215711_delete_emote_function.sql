-- Create delete_emote function
CREATE OR REPLACE FUNCTION delete_emote(
  IN p_room_name text,
  IN p_emote_name text
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
BEGIN
  DELETE FROM emote AS e
  USING room AS r
  WHERE r.id = e.room_id AND r.name = p_room_name AND e.name = p_emote_name;
END;
$BODY$;
