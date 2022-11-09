CREATE TABLE image
(
  id bigserial NOT NULL,
  post_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  filename text NOT NULL,
  hash text NOT NULL,
  ext text NOT NULL,
  tn_ext text NOT NULL,

  PRIMARY KEY (id),

  FOREIGN KEY (post_id)
    REFERENCES post (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE
    NOT VALID,

  UNIQUE (post_id)
);

SELECT manage_updated_at('image'); -- Automatically manage updated_at

CREATE INDEX image_post_id_idx ON image
  USING btree
  (post_id ASC NULLS LAST);
