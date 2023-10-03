CREATE FUNCTION set_room_playback_state(
  IN p_room_id integer,
  IN p_playback_state json
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
BEGIN
  UPDATE room
  SET playback_state = p_playback_state
  WHERE id = p_room_id;
END;
$BODY$;
