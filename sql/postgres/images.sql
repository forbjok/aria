-- Table: images

-- DROP TABLE images;

CREATE TABLE images
(
  id serial NOT NULL,
  filename text NOT NULL,
  thumbnail_filename text NOT NULL,
  original_filename text NOT NULL,
  CONSTRAINT images_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE images
  OWNER TO aria;
