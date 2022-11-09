CREATE FUNCTION set_room_content(
  IN p_room_id integer,
  IN p_content json
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
BEGIN
  UPDATE room
  SET content = p_content
  WHERE id = p_room_id;
END;
$BODY$;
