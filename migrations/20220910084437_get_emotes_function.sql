-- Create get_emotes function
CREATE OR REPLACE FUNCTION get_emotes(IN p_room_name text)
RETURNS SETOF emote
LANGUAGE sql

AS $BODY$
SELECT e.*
FROM emote AS e
INNER JOIN room AS r ON r.id = e.room_id
WHERE r.name = p_room_name
$BODY$;
