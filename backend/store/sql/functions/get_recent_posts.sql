CREATE FUNCTION get_recent_posts(IN p_room_id integer, IN p_count integer)
RETURNS TABLE (post post, image image)
LANGUAGE plpgsql

AS $BODY$
BEGIN
  RETURN QUERY
  SELECT p AS post, i AS image
  FROM post AS p
  LEFT JOIN image AS i ON i.post_id = p.id
  WHERE p.room_id = p_room_id AND NOT p.is_deleted
  ORDER BY p.id DESC
  LIMIT p_count;
END;
$BODY$;
