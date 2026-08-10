CREATE OR REPLACE FUNCTION public.get_auth_schema()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_users json;
  v_identities json;
BEGIN
  SELECT json_agg(row_to_json(c)) INTO v_users
  FROM (
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) c;

  SELECT json_agg(row_to_json(c)) INTO v_identities
  FROM (
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'identities'
  ) c;

  RETURN json_build_object('users', v_users, 'identities', v_identities);
END;
$$;
