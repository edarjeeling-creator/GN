-- Run this in your Supabase SQL Editor
-- This creates a secure function to create teachers directly, bypassing the email sending error.

CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.create_teacher_bypass(
  p_email TEXT,
  p_password TEXT,
  p_name TEXT,
  p_school_id UUID
) RETURNS json AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Generate a new UUID for the user
  v_user_id := gen_random_uuid();

  -- 1. Insert into auth.users (Bypasses GoTrue email sending)
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

  -- 2. The handle_new_user trigger WILL fire here automatically, inserting into public.profiles.
  -- But just in case the trigger is disabled or fails, we can ensure the profile exists.
  -- We use ON CONFLICT DO NOTHING to avoid duplicate key errors if the trigger succeeds.
  
  INSERT INTO public.profiles (id, name, role, school_id)
  VALUES (v_user_id, p_name, 'teacher', COALESCE(p_school_id, 'd3b07384-d113-4956-a5ec-9af2c61146e5'::uuid))
  ON CONFLICT (id) DO NOTHING;

  RETURN json_build_object('success', true, 'user_id', v_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;
