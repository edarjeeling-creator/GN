-- Ultimate fallback script to create the user directly in the database
-- This bypasses all Supabase API issues and manually wires up the auth identities!

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  -- 1. Wipe the slate clean
  DELETE FROM auth.identities WHERE identity_data->>'email' = 'accountant@gyanodayniketan.cloud';
  DELETE FROM auth.users WHERE email = 'accountant@gyanodayniketan.cloud';

  -- 2. Create the User explicitly
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'accountant@gyanodayniketan.cloud',
    crypt('Gyanoday@2026', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name": "School Accountant", "role": "admin"}'
  );

  -- 3. Wire up the Identity (THIS fixes the 'Database error querying schema' issue!)
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider
  ) VALUES (
    new_user_id::text,
    new_user_id,
    new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', 'accountant@gyanodayniketan.cloud'),
    'email'
  );

  -- 4. Make absolutely sure they have Admin privileges
  UPDATE public.profiles 
  SET role = 'admin', name = 'School Accountant'
  WHERE id = new_user_id;
  
END $$;
