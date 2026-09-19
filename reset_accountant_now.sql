-- ==============================================================================
-- reset_accountant_now.sql
-- Fix for Accountant (accountant@gyanodayniketan.cloud) Login & GoTrue Identity
--
-- Why this is needed:
-- The accountant user was created with NULL created_at timestamps in auth.users
-- and auth.identities, and without email_verified/phone_verified fields.
-- This caused Supabase GoTrue to crash (HTTP 500 Internal Server Error)
-- during password verification, showing "Invalid login credentials" in the UI.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

DO $$
DECLARE
  v_target_user_id UUID := '5731e645-80ac-491e-8118-8e12c2f87c7b';
  v_target_email TEXT := 'accountant@gyanodayniketan.cloud';
  v_password TEXT := 'Gyanoday@2026'; -- Change this to your preferred password
BEGIN
  -- 1. Remove broken identities for this user
  DELETE FROM auth.identities 
  WHERE email = v_target_email 
     OR identity_data->>'email' = v_target_email 
     OR user_id = v_target_user_id;

  -- 2. Clean up any duplicate auth.users records holding this email
  DELETE FROM auth.users 
  WHERE email = v_target_email 
    AND id != v_target_user_id;

  -- 3. Upsert auth.users record with non-null created_at, empty tokens, and cost 10 bcrypt
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_target_user_id) THEN
    UPDATE auth.users
    SET email = v_target_email,
        encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        banned_until = NULL,
        confirmation_token = '',
        recovery_token = '',
        email_change_token_new = '',
        email_change = '',
        phone_change = '',
        phone_change_token = '',
        email_change_token_current = '',
        reauthentication_token = '',
        email_change_confirm_status = 0,
        raw_app_meta_data = '{"provider":"email","providers":["email"]}',
        raw_user_meta_data = jsonb_build_object(
          'name', 'School Accountant',
          'full_name', 'School Accountant',
          'role', 'accountant',
          'email_verified', true
        ),
        created_at = COALESCE(created_at, now()),
        updated_at = now(),
        is_super_admin = false,
        is_sso_user = false,
        is_anonymous = false
    WHERE id = v_target_user_id;
  ELSE
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
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      phone_change,
      phone_change_token,
      email_change_token_current,
      reauthentication_token,
      email_change_confirm_status,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      is_sso_user,
      is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_target_user_id,
      'authenticated',
      'authenticated',
      v_target_email,
      extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
      now(),
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      0,
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object(
        'name', 'School Accountant',
        'full_name', 'School Accountant',
        'role', 'accountant',
        'email_verified', true
      ),
      false,
      false,
      false
    );
  END IF;

  -- 4. Create the identity record for GoTrue authentication
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_target_user_id,
    v_target_user_id::text,
    jsonb_build_object(
      'sub', v_target_user_id::text,
      'email', v_target_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  -- 5. Ensure public.profiles is active with role 'accountant'
  INSERT INTO public.profiles (id, name, role, email, status, school_id, campus)
  VALUES (v_target_user_id, 'School Accountant', 'accountant', v_target_email, 'Active', 'd3b07384-d113-4956-a5ec-9af2c61146e5', 'Senior School')
  ON CONFLICT (id) DO UPDATE SET
    name = 'School Accountant',
    role = 'accountant',
    email = v_target_email,
    status = 'Active';

  RAISE NOTICE 'SUCCESS: Synchronized Accountant user with auth.users and GoTrue identity.';
END $$;
