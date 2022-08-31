-- Create set_room_content function
CREATE OR REPLACE FUNCTION set_room_content(
  IN p_room_name text,
  IN p_content json
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_room_id integer;
BEGIN
  SELECT id INTO v_room_id FROM get_room_by_name(p_room_name);

  UPDATE room
  SET content = p_content
  WHERE id = v_room_id;
END;
$BODY$;

-- Drop old set_room_content_url function
DROP FUNCTION set_room_content_url;