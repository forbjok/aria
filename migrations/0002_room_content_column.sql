-- Add column "content" to "room" table
ALTER TABLE room
  ADD COLUMN content json;