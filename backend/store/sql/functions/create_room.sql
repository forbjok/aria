CREATE FUNCTION create_room(
  IN p_name text,
  IN p_password text
)
RETURNS SETOF room
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_room_id integer;
BEGIN
  SELECT id INTO v_room_id FROM get_room_by_name(p_name);
  IF v_room_id IS NOT NULL THEN
    RAISE EXCEPTION 'Room already exists.';
  END IF;

  -- Insert post
  RETURN QUERY
  INSERT INTO room (
    name,
		claimed_at,
		expires_at,
    password
  )
  SELECT
    p_name, -- name
		CURRENT_TIMESTAMP, -- claimed_at
		to_timestamp('9999-12-31', 'YYYY-MM-DD'), -- expires_at
    p_password -- password
  RETURNING *;
END;
$BODY$;
