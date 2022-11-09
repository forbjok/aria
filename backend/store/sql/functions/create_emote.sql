CREATE FUNCTION create_emote(
  IN p_room_id integer,
  IN p_emote new_emote
)
RETURNS SETOF emote
LANGUAGE plpgsql

AS $BODY$
BEGIN
  -- Insert emote
  RETURN QUERY
  INSERT INTO emote (
    room_id,
    name,
    hash,
    ext
  )
  SELECT
    p_room_id, -- room_id
    p_emote.name, -- name
    p_emote.hash, -- hash
    p_emote.ext -- ext
  ON CONFLICT (room_id, name) DO UPDATE SET hash = p_emote.hash, ext = p_emote.ext
  RETURNING *;
END;
$BODY$;
