-- Table: rooms

-- DROP TABLE rooms;

CREATE TABLE rooms
(
  id serial NOT NULL,
  name text NOT NULL,
  content_url text NOT NULL,
  password text NOT NULL,
  claimed timestamp without time zone NOT NULL,
  expires timestamp without time zone NOT NULL,
  CONSTRAINT rooms_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE rooms
  OWNER TO aria;

-- Index: rooms_name_idx

-- DROP INDEX rooms_name_idx;

CREATE UNIQUE INDEX rooms_name_idx
  ON rooms
  USING btree
  (name COLLATE pg_catalog."default");
