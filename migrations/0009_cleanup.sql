DROP FUNCTION IF EXISTS get_posts;

-- Create get_posts function
CREATE OR REPLACE FUNCTION get_posts(IN p_room_name text)
RETURNS TABLE (post post, image image)
LANGUAGE sql

AS $BODY$
SELECT p AS post, i AS image
FROM post AS p
INNER JOIN room AS r ON r.id = p.room_id
LEFT JOIN image AS i ON i.post_id = p.id
WHERE r.name = p_room_name
$BODY$;

-- Create set_room_content_url function
CREATE OR REPLACE FUNCTION set_room_content_url(
  IN p_room_name text,
  IN p_content_url text
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_room_id integer;
BEGIN
  SELECT id INTO v_room_id FROM get_room_by_name(p_room_name);

  UPDATE room
  SET content_url = p_content_url
  WHERE id = v_room_id;
END;
$BODY$;
