-- Drop old functions
DROP FUNCTION delete_post;
DROP FUNCTION delete_emote;

-- Update delete_post function
CREATE OR REPLACE FUNCTION delete_post(
  IN p_room_id integer,
  IN p_post_id bigint,
  IN p_user_id bigint,
  IN p_is_admin boolean
)
RETURNS boolean
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_deleted_id bigint;
BEGIN
  IF p_is_admin THEN
    UPDATE post
    SET is_deleted = true
    WHERE room_id = p_room_id AND id = p_post_id AND NOT is_deleted
    RETURNING id INTO v_deleted_id;
  ELSE
    UPDATE post
    SET is_deleted = true
    WHERE room_id = p_room_id AND id = p_post_id AND NOT is_deleted AND user_id = p_user_id
    RETURNING id INTO v_deleted_id;
  END IF;

  RETURN v_deleted_id IS NOT NULL;
END;
$BODY$;

-- Update delete_emote function
CREATE OR REPLACE FUNCTION delete_emote(
  IN p_room_id integer,
  IN p_emote_id integer
)
RETURNS boolean
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_deleted_id integer;
BEGIN
  DELETE FROM emote AS e
  WHERE e.room_id = p_room_id AND e.id = p_emote_id
  RETURNING id INTO v_deleted_id;

  RETURN v_deleted_id IS NOT NULL;
END;
$BODY$;
