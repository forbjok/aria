-- Create name index on room
CREATE INDEX room_name_idx ON room
  USING btree
  (name ASC NULLS LAST);

-- Create room_id index on post
CREATE INDEX post_room_id_idx ON post
  USING btree
  (room_id ASC NULLS LAST);

-- Create post_id index on image
CREATE INDEX image_post_id_idx ON image
  USING btree
  (post_id ASC NULLS LAST);

-- Create room_id index on emote
CREATE INDEX emote_room_id_idx ON emote
  USING btree
  (room_id ASC NULLS LAST);
