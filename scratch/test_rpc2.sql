CREATE OR REPLACE FUNCTION public.test_bypass(
  p_email TEXT,
  p_password TEXT
) RETURNS json AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    p_email, extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    json_build_object('name', 'test', 'full_name', 'test', 'role', 'teacher'),
    false
  );
  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
  ) VALUES (
    v_user_id::text, v_user_id,
    json_build_object('sub', v_user_id, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now(), gen_random_uuid()
  );
  RETURN json_build_object('success', true, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;
