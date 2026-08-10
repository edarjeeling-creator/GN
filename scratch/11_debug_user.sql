CREATE OR REPLACE FUNCTION public.debug_get_user(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user json;
  v_identity json;
BEGIN
  SELECT row_to_json(u) INTO v_user FROM auth.users u WHERE email = p_email;
  SELECT row_to_json(i) INTO v_identity FROM auth.identities i WHERE identity_data->>'email' = p_email;
  
  RETURN json_build_object('user', v_user, 'identity', v_identity);
END;
$$;
