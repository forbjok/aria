CREATE FUNCTION refresh_refresh_token(
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
