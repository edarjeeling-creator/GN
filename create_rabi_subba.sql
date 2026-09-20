-- ==============================================================================
-- create_rabi_subba.sql
-- Direct Creation for Non-Teaching Staff: Rabi Subba (Sports Director)
-- Full GoTrue-compatible auth.users, auth.identities, and public.profiles setup
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

DO $$
DECLARE
  v_target_user_id UUID := 'c34d18e4-a652-49aa-874a-21229d8d1063';
  v_target_email TEXT := 'rabi@gyanodayniketan.cloud';
  v_target_name TEXT := 'Rabi Subba';
  v_password TEXT := 'Gyanoday@1234'; -- Password for login
  v_role TEXT := 'non_teaching';
  v_designation TEXT := 'Sports Director';
  v_campus TEXT := 'Senior School';
BEGIN
  -- 1. Remove broken identities for this user
  DELETE FROM auth.identities 
  WHERE email = v_target_email 
     OR identity_data->>'email' = v_target_email 
     OR user_id = v_target_user_id;

  -- 2. Clean up any duplicate auth.users records holding this email
  DELETE FROM auth.users 
  WHERE lower(email) = lower(v_target_email) 
    AND id != v_target_user_id;

  -- 3. Upsert auth.users record with full GoTrue compatibility fields
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
          'name', v_target_name,
          'full_name', v_target_name,
          'role', v_role,
          'campus', v_campus,
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
        'name', v_target_name,
        'full_name', v_target_name,
        'role', v_role,
        'campus', v_campus,
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

  -- 5. Ensure public.profiles is fully updated with Non-Teaching role & Designation
  INSERT INTO public.profiles (id, name, role, email, status, school_id, campus, designation)
  VALUES (
    v_target_user_id, 
    v_target_name, 
    v_role, 
    v_target_email, 
    'Active', 
    'd3b07384-d113-4956-a5ec-9af2c61146e5', 
    v_campus, 
    v_designation
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    email = EXCLUDED.email,
    campus = EXCLUDED.campus,
    designation = EXCLUDED.designation,
    status = 'Active';

  RAISE NOTICE 'SUCCESS: Rabi Subba created and ready for login with password %', v_password;
END $$;
