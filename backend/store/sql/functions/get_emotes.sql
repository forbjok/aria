CREATE FUNCTION get_emotes(IN p_room_id integer)
RETURNS SETOF emote
LANGUAGE plpgsql

AS $BODY$
BEGIN
  RETURN QUERY
  SELECT e.*
  FROM emote AS e
  WHERE e.room_id = p_room_id;
END;
$BODY$;
