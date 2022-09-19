-- Drop old slow get_posts function
DROP FUNCTION get_posts;

-- Create get_recent_posts function
CREATE OR REPLACE FUNCTION get_recent_posts(IN p_room_name text, IN p_count integer)
RETURNS TABLE (post post, image image)
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_room_id integer;
BEGIN
  SELECT id INTO v_room_id FROM get_room_by_name(p_room_name);

  RETURN QUERY
  SELECT p AS post, i AS image
  FROM post AS p
  LEFT JOIN image AS i ON i.post_id = p.id
  WHERE p.room_id = v_room_id AND NOT p.is_deleted
  ORDER BY p.id DESC
  LIMIT p_count;
END;
$BODY$;

-- Update get_emotes function
CREATE OR REPLACE FUNCTION get_emotes(IN p_room_name text)
RETURNS SETOF emote
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_room_id integer;
BEGIN
  SELECT id INTO v_room_id FROM get_room_by_name(p_room_name);

  RETURN QUERY
  SELECT e.*
  FROM emote AS e
  WHERE e.room_id = v_room_id;
END;
$BODY$;

-- Update delete_emote function
CREATE OR REPLACE FUNCTION delete_emote(
  IN p_room_name text,
  IN p_emote_name text
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_room_id integer;
BEGIN
  SELECT id INTO v_room_id FROM get_room_by_name(p_room_name);

  DELETE FROM emote AS e
  WHERE e.room_id = v_room_id AND e.name = p_emote_name;
END;
$BODY$;

-- Update delete_post function
CREATE OR REPLACE FUNCTION delete_post(
  IN p_room_name text,
  IN p_post_id bigint
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_room_id integer;
BEGIN
  SELECT id INTO v_room_id FROM get_room_by_name(p_room_name);

  UPDATE post
  SET is_deleted = true
  WHERE room_id = v_room_id AND id = p_post_id;
END;
$BODY$;
