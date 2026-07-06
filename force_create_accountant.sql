-- Run this script in the Supabase SQL Editor to bypass the API error.
-- This securely creates the Accountant user directly in the database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  -- 1. Create the user in auth.users
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
    new_user_id,
    'authenticated',
    'authenticated',
    'accountant@gyanodayniketan.cloud',
    crypt('Gyanoday@2026', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false
  );

  -- 2. Give the user the Accountant profile
  INSERT INTO public.profiles (id, name, role)
  VALUES (new_user_id, 'School Accountant', 'admin'); 
  -- Note: We use 'admin' role here so they have access to the Admin Dashboard to view the Fees section!

END $$;
