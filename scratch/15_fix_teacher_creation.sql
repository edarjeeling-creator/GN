-- Run this in your Supabase SQL Editor to fix the teacher creation error.
-- The error "cannot insert a non-DEFAULT value into column confirmed_at" occurs
-- because newer Supabase versions make 'confirmed_at' a generated column.

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

  -- 1. Insert into auth.users without 'confirmed_at'
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    json_build_object('name', p_name, 'full_name', p_name, 'role', 'teacher', 'school_id', p_school_id),
    false
  );

  -- 2. Insert into auth.identities
  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    id
  ) VALUES (
    v_user_id::text,
    v_user_id,
    json_build_object('sub', v_user_id, 'email', p_email, 'email_verified', true),
    'email',
    now(),
    now(),
    now(),
    gen_random_uuid()
  );

  -- 3. Ensure profile exists in public.profiles (in case the trigger fails or is disabled)
  INSERT INTO public.profiles (id, name, role, school_id)
  VALUES (v_user_id, p_name, 'teacher', COALESCE(p_school_id, 'd3b07384-d113-4956-a5ec-9af2c61146e5'::uuid))
  ON CONFLICT (id) DO NOTHING;

  RETURN json_build_object('success', true, 'user_id', v_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;
