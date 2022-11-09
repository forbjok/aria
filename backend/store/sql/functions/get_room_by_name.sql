CREATE FUNCTION get_room_by_name(IN p_room_name text)
RETURNS SETOF room
LANGUAGE sql

AS $BODY$
SELECT * FROM room WHERE name = p_room_name LIMIT 1;
$BODY$;
