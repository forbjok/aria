CREATE FUNCTION delete_emote(
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
