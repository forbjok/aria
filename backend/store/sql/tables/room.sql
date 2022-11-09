CREATE TABLE room
(
  id serial NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  name text NOT NULL,
  claimed_at timestamp with time zone NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  password text NOT NULL,
  content json,

  PRIMARY KEY (id),

  UNIQUE (name)
);

SELECT manage_updated_at('room'); -- Automatically manage updated_at

CREATE INDEX room_name_idx ON room
  USING btree
  (name ASC NULLS LAST);
