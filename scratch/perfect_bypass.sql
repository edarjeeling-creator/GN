CREATE OR REPLACE FUNCTION public.create_teacher_bypass(
  p_email TEXT,
  p_password TEXT,
  p_name TEXT,
  p_school_id UUID
) RETURNS json AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := gen_random_uuid();

  -- Insert EXACTLY matching what GoTrue does for email/password signups
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, 
    is_super_admin, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    p_email, extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(),
    now(), now(), now(), '{"provider":"email","providers":["email"]}',
    json_build_object('name', p_name, 'full_name', p_name, 'role', 'teacher', 'school_id', p_school_id),
    false, false, false
  );

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, email, id
  ) VALUES (
    v_user_id::text, v_user_id,
    json_build_object('sub', v_user_id, 'email', p_email, 'email_verified', false, 'phone_verified', false),
    'email', now(), now(), now(), p_email, gen_random_uuid()
  );

  RETURN json_build_object('success', true, 'user_id', v_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;
