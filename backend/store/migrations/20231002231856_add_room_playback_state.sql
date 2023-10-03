-- Add playback_state column to room table
ALTER TABLE room
  ADD COLUMN playback_state json;

DROP FUNCTION set_room_content;
CREATE FUNCTION set_room_content(
  IN p_room_id integer,
  IN p_content json
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
BEGIN
  UPDATE room
  SET content = p_content,
      playback_state = NULL
  WHERE id = p_room_id;
END;
$BODY$;

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
