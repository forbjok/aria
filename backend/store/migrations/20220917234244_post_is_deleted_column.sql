-- Add is_deleted column to post
ALTER TABLE post
  ADD COLUMN is_deleted boolean NOT NULL DEFAULT False;

-- Create delete_post function
CREATE OR REPLACE FUNCTION delete_post(
  IN p_room_name text,
  IN p_post_id bigint
)
RETURNS VOID
LANGUAGE plpgsql

AS $BODY$
BEGIN
  UPDATE post AS p
  SET is_deleted = true
  FROM room AS r
  WHERE r.id = p.room_id AND r.name = p_room_name AND p.id = p_post_id;
END;
$BODY$;

-- Update get_posts function
CREATE OR REPLACE FUNCTION get_posts(IN p_room_name text)
RETURNS TABLE (post post, image image)
LANGUAGE sql

AS $BODY$
SELECT p AS post, i AS image
FROM post AS p
INNER JOIN room AS r ON r.id = p.room_id
LEFT JOIN image AS i ON i.post_id = p.id
WHERE r.name = p_room_name AND NOT p.is_deleted
$BODY$;
