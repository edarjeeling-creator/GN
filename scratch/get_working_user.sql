CREATE OR REPLACE FUNCTION public.get_working_user()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user json;
  v_identity json;
BEGIN
  -- We fetch a known working user that I created earlier via the API which logs in successfully
  SELECT row_to_json(u) INTO v_user
  FROM auth.users u WHERE email = 'test_admin_create_5@gyanodayniketan.cloud' LIMIT 1;

  SELECT row_to_json(i) INTO v_identity
  FROM auth.identities i 
  WHERE user_id = (v_user->>'id')::uuid LIMIT 1;

  RETURN json_build_object('user', v_user, 'identity', v_identity);
END;
$$;
