CREATE FUNCTION create_refresh_token(
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
