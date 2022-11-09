CREATE TABLE refresh_token
(
  id bigserial NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  token uuid NOT NULL DEFAULT gen_random_uuid(),
  family bigint NOT NULL,
  used boolean NOT NULL DEFAULT false,
  expires_at timestamp with time zone NOT NULL DEFAULT (CURRENT_TIMESTAMP + '30 days'::interval),
  claims text NOT NULL,

  PRIMARY KEY (id),

  UNIQUE (token)
);

SELECT manage_updated_at('refresh_token'); -- Automatically manage updated_at

CREATE INDEX refresh_token_token_idx ON refresh_token
  USING btree
  (token ASC NULLS LAST);

CREATE INDEX refresh_token_family_idx ON refresh_token
  USING btree
  (family ASC NULLS LAST);
