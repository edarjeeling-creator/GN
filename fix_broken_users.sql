-- Run this in your Supabase SQL Editor to clean up broken users and fix the bypass function.

-- 1. Delete broken users that have no identities, handling foreign key constraints
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM auth.identities) AND role = 'authenticated'
  LOOP
    -- Delete from dependent tables first
    DELETE FROM public.lib_members WHERE user_id = r.id;
    DELETE FROM public.profiles WHERE id = r.id;
    
    -- Now delete the auth.user
    DELETE FROM auth.users WHERE id = r.id;
  END LOOP;
END $$;

-- 2. Update the create_teacher_bypass function to properly create identities
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

  -- Insert into auth.users
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

  -- Insert into auth.identities so GoTrue doesn't crash on login
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

  -- Ensure profile exists
  INSERT INTO public.profiles (id, name, role, school_id)
  VALUES (v_user_id, p_name, 'teacher', COALESCE(p_school_id, 'd3b07384-d113-4956-a5ec-9af2c61146e5'::uuid))
  ON CONFLICT (id) DO NOTHING;

  RETURN json_build_object('success', true, 'user_id', v_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;
