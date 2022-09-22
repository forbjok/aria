-- Create refresh_token table
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

-- Create indexes
CREATE INDEX refresh_token_token_idx ON refresh_token
  USING btree
  (token ASC NULLS LAST);

CREATE INDEX refresh_token_family_idx ON refresh_token
  USING btree
  (family ASC NULLS LAST);

-- Create refresh token family sequence
CREATE SEQUENCE refresh_token_family_seq AS bigint;

-- Create refresh_refresh_token_result type
CREATE TYPE refresh_refresh_token_result AS (token uuid, claims text);

-- Create create_refresh_token function
CREATE OR REPLACE FUNCTION create_refresh_token(
  IN p_claims text
)
RETURNS uuid
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_new_token uuid;
BEGIN
  -- Generate new refresh token with new family
  INSERT INTO refresh_token (family, claims)
  VALUES (nextval('refresh_token_family_seq'), p_claims)
  RETURNING token INTO v_new_token;

  -- Return new token
  RETURN v_new_token;
END;
$BODY$;

-- Create refresh_refresh_token function
CREATE OR REPLACE FUNCTION refresh_refresh_token(
  IN p_token uuid
)
RETURNS refresh_refresh_token_result
LANGUAGE plpgsql

AS $BODY$
DECLARE
  v_refresh_token refresh_token;
  v_result refresh_refresh_token_result;
BEGIN
  SELECT * INTO v_refresh_token
  FROM refresh_token
  WHERE token = p_token;

  -- Check if exists
  IF v_refresh_token IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if already used
  IF v_refresh_token.used THEN
    UPDATE refresh_token
    SET used = true
    WHERE family = v_refresh_token.family;

    RETURN NULL;
  END IF;

  -- Check if expired
  IF v_refresh_token.expires_at < CURRENT_TIMESTAMP THEN
    RETURN NULL;
  END IF;

  -- Mark token as used
  UPDATE refresh_token
  SET used = true
  WHERE id = v_refresh_token.id;

  -- Generate new refresh token
  INSERT INTO refresh_token (family, claims)
  VALUES (v_refresh_token.family, v_refresh_token.claims)
  RETURNING token, claims INTO v_result;

  -- Return result
  RETURN v_result;
END;
$BODY$;
