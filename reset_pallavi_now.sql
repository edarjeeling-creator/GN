-- ==============================================================================
-- reset_pallavi_now.sql
-- Direct Fix for Pallavi Bakshi Gupta Login & ERP Profile Synchronization
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

DO $$
DECLARE
  v_target_user_id UUID := '0c931bba-2279-4871-ad49-a5c358d46c14';
  v_target_email TEXT := 'pallavi.bakshi.gupta@gyanodayniketan.cloud';
  v_password TEXT := 'Pallavi@2026';
BEGIN
  -- 1. Remove any orphaned identities for this email or old auth UUIDs
  DELETE FROM auth.identities 
  WHERE email = v_target_email 
     OR identity_data->>'email' = v_target_email 
     OR user_id IN ('7bd7116c-95b0-4579-9a1a-17c467e26c6e'::UUID, 'ab0c65c3-41bf-4e32-aa0a-729d792bc4fa'::UUID, v_target_user_id);

  -- 2. Remove orphaned/duplicate auth.users records holding this email
  DELETE FROM auth.users 
  WHERE email IN (v_target_email, 'pallavi@gyanodayniketan.cloud') 
    AND id != v_target_user_id;

  -- 3. Upsert auth.users record with the EXACT UUID matching public.profiles (0c931bba-2279-4871-ad49-a5c358d46c14)
  -- Note: confirmed_at is a generated column and is omitted.
  -- All token fields are set to '' (empty string) to satisfy GoTrue scan requirements.
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
          'name', 'Pallavi Bakshi Gupta',
          'full_name', 'Pallavi Bakshi Gupta',
          'role', 'teacher',
          'school_id', 'd3b07384-d113-4956-a5ec-9af2c61146e5',
          'email_verified', true
        ),
        is_super_admin = false,
        is_sso_user = false,
        is_anonymous = false,
        updated_at = now()
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
        'name', 'Pallavi Bakshi Gupta',
        'full_name', 'Pallavi Bakshi Gupta',
        'role', 'teacher',
        'school_id', 'd3b07384-d113-4956-a5ec-9af2c61146e5',
        'email_verified', true
      ),
      false,
      false,
      false
    );
  END IF;

  -- 4. Create the identity record for GoTrue authentication
  -- Note: auth.identities.email is a generated column (generated from identity_data->>'email'),
  -- so we do not insert into the email column directly.
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
      'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
  );

  -- 5. Ensure public.profiles has matching email and status
  UPDATE public.profiles
  SET email = v_target_email,
      name = 'Pallavi Bakshi Gupta',
      role = 'teacher',
      status = 'Active',
      updated_at = now()
  WHERE id = v_target_user_id;

  RAISE NOTICE 'SUCCESS: Synchronized Pallavi Bakshi Gupta with auth.users and GoTrue identity.';
END $$;
