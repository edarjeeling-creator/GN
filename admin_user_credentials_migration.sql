-- ==============================================================================
-- admin_user_credentials_migration.sql
-- Production-Audited User Management & Security Migration
-- Gyanoday Niketan ERP
-- ==============================================================================

-- 1. Ensure pgcrypto extension is active for bcrypt encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- 2. Audit Logs Table & Security Events Table
CREATE TABLE IF NOT EXISTS public.user_management_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_user_id UUID,
    action TEXT NOT NULL, -- 'USER_CREATED', 'USER_UPDATED', 'CREDENTIALS_UPDATED', 'USER_DEACTIVATED', 'USER_REACTIVATED', 'USER_DELETED'
    previous_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_id UUID,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for audit tables
ALTER TABLE public.user_management_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin read audit logs" ON public.user_management_audit_logs;
CREATE POLICY "Allow admin read audit logs" ON public.user_management_audit_logs 
FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'principal')));

DROP POLICY IF EXISTS "Allow admin insert audit logs" ON public.user_management_audit_logs;
CREATE POLICY "Allow admin insert audit logs" ON public.user_management_audit_logs 
FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'principal')));

DROP POLICY IF EXISTS "Allow admin read security_events" ON public.security_events;
CREATE POLICY "Allow admin read security_events" ON public.security_events 
FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'principal')));

-- 3. Schema updates for public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS campus TEXT DEFAULT 'Senior School';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

UPDATE public.profiles
SET status = 'Active'
WHERE status IS NULL OR status = '';

-- 4. IMMEDIATE PASSWORD RESET FOR PALLAVI BAKSHI GUPTA
-- Synchronizes the exact UUID from public.profiles ('0c931bba-2279-4871-ad49-a5c358d46c14')
-- with auth.users and auth.identities, ensuring all GoTrue token fields are non-null empty strings.
DO $$
DECLARE
  v_target_user_id UUID := '0c931bba-2279-4871-ad49-a5c358d46c14';
  v_target_email TEXT := 'pallavi.bakshi.gupta@gyanodayniketan.cloud';
  v_password TEXT := 'Pallavi@2026';
BEGIN
  -- Remove orphaned identities for this email or old auth UUIDs
  DELETE FROM auth.identities 
  WHERE email = v_target_email 
     OR identity_data->>'email' = v_target_email 
     OR user_id IN ('7bd7116c-95b0-4579-9a1a-17c467e26c6e'::UUID, 'ab0c65c3-41bf-4e32-aa0a-729d792bc4fa'::UUID, v_target_user_id);

  -- Remove orphaned/duplicate auth.users records holding this email
  DELETE FROM auth.users 
  WHERE email IN (v_target_email, 'pallavi@gyanodayniketan.cloud') 
    AND id != v_target_user_id;

  -- Upsert auth.users record with the EXACT UUID matching public.profiles (0c931bba-2279-4871-ad49-a5c358d46c14)
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

  -- Create clean identity record for GoTrue authentication
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

  -- Ensure public.profiles has matching email and status
  UPDATE public.profiles
  SET email = v_target_email,
      name = 'Pallavi Bakshi Gupta',
      role = 'teacher',
      status = 'Active',
      updated_at = now()
  WHERE id = v_target_user_id;
END $$;

-- 5. Cleanly drop previous function signatures to avoid parameter name conflict (ERROR 42P13)
DROP FUNCTION IF EXISTS public.admin_create_user CASCADE;
DROP FUNCTION IF EXISTS public.admin_update_user CASCADE;
DROP FUNCTION IF EXISTS public.admin_update_user_credentials CASCADE;
DROP FUNCTION IF EXISTS public.admin_set_user_status CASCADE;
DROP FUNCTION IF EXISTS public.admin_delete_user_safe CASCADE;
DROP FUNCTION IF EXISTS public.lookup_staff_email_by_name CASCADE;
DROP FUNCTION IF EXISTS public.get_staff_credentials_directory CASCADE;

-- 6. RPC: admin_create_user
-- Securely creates user in auth.users and public.profiles atomically
DROP FUNCTION IF EXISTS public.admin_create_user CASCADE;
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_name TEXT,
  p_role TEXT DEFAULT 'teacher',
  p_campus TEXT DEFAULT 'Senior School',
  p_status TEXT DEFAULT 'Active',
  p_school_id UUID DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5'::UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_user_id UUID;
  v_clean_email TEXT;
  v_clean_name TEXT;
  v_clean_role TEXT;
  v_clean_campus TEXT;
  v_clean_status TEXT;
BEGIN
  -- Strict Authentication Check: Must be logged in
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Authentication session required.');
  END IF;

  -- Server-side Role Check
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'superadmin', 'principal') THEN
    RETURN json_build_object('success', false, 'error', 'Forbidden. Only administrators and principals can create user accounts.');
  END IF;

  v_clean_email := lower(trim(COALESCE(p_email, '')));
  v_clean_name := trim(COALESCE(p_name, ''));
  v_clean_role := lower(trim(COALESCE(p_role, 'teacher')));
  v_clean_campus := trim(COALESCE(p_campus, 'Senior School'));
  v_clean_status := trim(COALESCE(p_status, 'Active'));

  IF v_clean_email = '' OR p_password = '' OR v_clean_name = '' THEN
    RETURN json_build_object('success', false, 'error', 'Name, email, and password are required.');
  END IF;

  IF v_clean_role NOT IN ('teacher', 'admin', 'principal', 'accountant', 'librarian', 'coordinator') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid role selected.');
  END IF;

  -- Role Escalation Protection:
  -- Only superadmin can create new administrators
  IF v_clean_role = 'superadmin' THEN
    RETURN json_build_object('success', false, 'error', 'Forbidden. Superadmin accounts cannot be created via the interface.');
  END IF;
  IF v_clean_role = 'admin' AND v_caller_role <> 'superadmin' THEN
    RETURN json_build_object('success', false, 'error', 'Forbidden. Only a Super Administrator can create new Administrator accounts.');
  END IF;

  -- Duplicate email check
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
    RETURN json_build_object('success', false, 'error', 'An account with this email address already exists.');
  END IF;

  v_user_id := gen_random_uuid();

  -- 1. Insert into auth.users (direct bcrypt hash, confirmed email, non-null GoTrue tokens)
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
    v_user_id,
    'authenticated',
    'authenticated',
    v_clean_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(),
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
    jsonb_build_object('name', v_clean_name, 'full_name', v_clean_name, 'role', v_clean_role, 'campus', v_clean_campus, 'email_verified', true),
    false,
    false,
    false
  );

  -- 2. Wire up auth.identities (GoTrue requires this for password login)
  IF EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
    UPDATE auth.identities
    SET identity_data = jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email, 'email_verified', true),
        provider_id = v_user_id::text,
        updated_at = now()
    WHERE user_id = v_user_id AND provider = 'email';
  ELSE
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
      v_user_id,
      v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email, 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    );
  END IF;

  -- 3. Upsert into public.profiles
  INSERT INTO public.profiles (
    id, name, email, role, campus, status, school_id
  ) VALUES (
    v_user_id, v_clean_name, v_clean_email, v_clean_role, v_clean_campus, v_clean_status, p_school_id
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    campus = EXCLUDED.campus,
    status = EXCLUDED.status;

  -- 4. Audit log (Never log password)
  BEGIN
    INSERT INTO public.user_management_audit_logs (
      admin_id, target_user_id, action, new_value
    ) VALUES (
      v_caller_id, v_user_id, 'USER_CREATED',
      json_build_object('name', v_clean_name, 'email', v_clean_email, 'role', v_clean_role, 'campus', v_clean_campus, 'status', v_clean_status)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('success', true, 'message', 'User created successfully.', 'user_id', v_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 7. RPC: admin_update_user
DROP FUNCTION IF EXISTS public.admin_update_user CASCADE;
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id UUID,
  p_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_campus TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_clean_email TEXT;
  v_clean_name TEXT;
  v_clean_role TEXT;
  v_clean_campus TEXT;
  v_clean_status TEXT;
  v_target_role TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Authentication session required.');
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'superadmin', 'principal') THEN
    RETURN json_build_object('success', false, 'error', 'Forbidden. Administrator or Principal privileges required.');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Target user does not exist.');
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;

  v_clean_email := lower(trim(COALESCE(p_email, '')));
  v_clean_name := trim(COALESCE(p_name, ''));
  v_clean_role := lower(trim(COALESCE(p_role, '')));
  v_clean_campus := trim(COALESCE(p_campus, ''));
  v_clean_status := trim(COALESCE(p_status, ''));

  -- Role Escalation Protection:
  -- Cannot edit own role
  IF p_user_id = v_caller_id AND v_clean_role <> '' AND v_clean_role <> v_caller_role THEN
    RETURN json_build_object('success', false, 'error', 'Safety protection: You cannot alter your own role.');
  END IF;
  -- Only superadmin can promote to admin
  IF v_clean_role = 'superadmin' THEN
    RETURN json_build_object('success', false, 'error', 'Forbidden. Cannot promote users to superadmin.');
  END IF;
  IF v_clean_role = 'admin' AND v_target_role <> 'admin' AND v_caller_role <> 'superadmin' THEN
    RETURN json_build_object('success', false, 'error', 'Forbidden. Only a Super Administrator can promote users to Administrator.');
  END IF;

  -- Duplicate email check
  IF v_clean_email <> '' THEN
    IF EXISTS(SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email AND id <> p_user_id) THEN
      RETURN json_build_object('success', false, 'error', 'An account with this email address already exists.');
    END IF;

    UPDATE auth.users
    SET email = v_clean_email,
        updated_at = now()
    WHERE id = p_user_id;

    UPDATE auth.identities
    SET identity_data = jsonb_set(COALESCE(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_clean_email)),
        updated_at = now()
    WHERE user_id = p_user_id AND provider = 'email';

    UPDATE public.profiles
    SET email = v_clean_email
    WHERE id = p_user_id;
  END IF;

  IF v_clean_name <> '' THEN
    UPDATE public.profiles SET name = v_clean_name WHERE id = p_user_id;
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{name}', to_jsonb(v_clean_name)),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  IF v_clean_role <> '' THEN
    UPDATE public.profiles SET role = v_clean_role WHERE id = p_user_id;
  END IF;

  IF v_clean_campus <> '' THEN
    UPDATE public.profiles SET campus = v_clean_campus WHERE id = p_user_id;
  END IF;

  IF v_clean_status <> '' THEN
    UPDATE public.profiles SET status = v_clean_status WHERE id = p_user_id;
  END IF;

  BEGIN
    INSERT INTO public.user_management_audit_logs (
      admin_id, target_user_id, action, new_value
    ) VALUES (
      v_caller_id, p_user_id, 'USER_UPDATED',
      json_build_object('name', v_clean_name, 'email', v_clean_email, 'role', v_clean_role, 'campus', v_clean_campus, 'status', v_clean_status)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('success', true, 'message', 'User updated successfully.');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 7. RPC: admin_update_user_credentials
DROP FUNCTION IF EXISTS public.admin_update_user_credentials CASCADE;
CREATE OR REPLACE FUNCTION public.admin_update_user_credentials(
  p_user_id UUID,
  p_new_name TEXT DEFAULT NULL,
  p_new_email TEXT DEFAULT NULL,
  p_new_password TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_clean_email TEXT;
  v_clean_name TEXT;
  v_clean_password TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Authentication session required.');
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'superadmin', 'principal') THEN
    RETURN json_build_object('success', false, 'error', 'Forbidden. Only administrators and principals can manage credentials.');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Target user does not exist.');
  END IF;

  v_clean_email := lower(trim(COALESCE(p_new_email, '')));
  v_clean_name := trim(COALESCE(p_new_name, ''));
  v_clean_password := trim(COALESCE(p_new_password, ''));

  IF v_clean_email <> '' THEN
    IF EXISTS(SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email AND id <> p_user_id) THEN
      RETURN json_build_object('success', false, 'error', 'An account with this email address already exists.');
    END IF;
  END IF;

  IF v_clean_password <> '' THEN
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(v_clean_password, extensions.gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, ''),
        phone_change = COALESCE(phone_change, ''),
        phone_change_token = COALESCE(phone_change_token, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        reauthentication_token = COALESCE(reauthentication_token, ''),
        email_change_confirm_status = 0,
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  IF v_clean_email <> '' THEN
    UPDATE auth.users
    SET email = v_clean_email,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{email}', to_jsonb(v_clean_email)),
        updated_at = now()
    WHERE id = p_user_id;

    UPDATE auth.identities
    SET identity_data = jsonb_set(COALESCE(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_clean_email)),
        updated_at = now()
    WHERE user_id = p_user_id AND provider = 'email';

    UPDATE public.profiles
    SET email = v_clean_email
    WHERE id = p_user_id;
  END IF;

  IF v_clean_name <> '' THEN
    UPDATE public.profiles
    SET name = v_clean_name
    WHERE id = p_user_id;

    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{name}', to_jsonb(v_clean_name)),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  BEGIN
    INSERT INTO public.user_management_audit_logs (
      admin_id, target_user_id, action, new_value
    ) VALUES (
      v_caller_id, p_user_id, 'CREDENTIALS_UPDATED',
      json_build_object(
        'name_updated', (v_clean_name <> ''),
        'email_updated', (v_clean_email <> ''),
        'password_reset', (v_clean_password <> '')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('success', true, 'message', 'Credentials updated successfully.');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 8. RPC: admin_set_user_status (Deactivate / Reactivate)
DROP FUNCTION IF EXISTS public.admin_set_user_status CASCADE;
CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  p_user_id UUID,
  p_status TEXT -- 'Active' or 'Inactive'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_target_role TEXT;
  v_target_name TEXT;
  v_clean_status TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Authentication session required.');
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'superadmin', 'principal') THEN
    RETURN json_build_object('success', false, 'error', 'Forbidden. Only administrators can change account status.');
  END IF;

  v_clean_status := trim(p_status);

  IF p_user_id = v_caller_id AND v_clean_status <> 'Active' THEN
    RETURN json_build_object('success', false, 'error', 'Safety protection: You cannot deactivate your own active account.');
  END IF;

  SELECT role, name INTO v_target_role, v_target_name FROM public.profiles WHERE id = p_user_id;
  IF v_target_role = 'superadmin' AND v_clean_status <> 'Active' THEN
    RETURN json_build_object('success', false, 'error', 'Safety protection: Super Administrator accounts cannot be deactivated.');
  END IF;

  UPDATE public.profiles
  SET status = v_clean_status
  WHERE id = p_user_id;

  BEGIN
    INSERT INTO public.user_management_audit_logs (
      admin_id, target_user_id, action, new_value
    ) VALUES (
      v_caller_id, p_user_id, CASE WHEN v_clean_status = 'Active' THEN 'USER_REACTIVATED' ELSE 'USER_DEACTIVATED' END,
      json_build_object('status', v_clean_status, 'user_name', v_target_name)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('success', true, 'message', 'User status updated to ' || v_clean_status || '.');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 9. RPC: admin_delete_user_safe (Safe permanent deletion with audit block)
DROP FUNCTION IF EXISTS public.admin_delete_user_safe CASCADE;
CREATE OR REPLACE FUNCTION public.admin_delete_user_safe(
  p_user_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_target_role TEXT;
  v_marks_count INT := 0;
  v_class_count INT := 0;
  v_assign_count INT := 0;
  v_attendance_count INT := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Authentication session required.');
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'superadmin') THEN
    RETURN json_build_object('success', false, 'error', 'Forbidden. Only administrators can delete accounts.');
  END IF;

  IF p_user_id = v_caller_id THEN
    RETURN json_build_object('success', false, 'error', 'Safety protection: You cannot delete your own active account.');
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;
  IF v_target_role = 'superadmin' THEN
    RETURN json_build_object('success', false, 'error', 'Safety protection: Super Administrator accounts cannot be deleted.');
  END IF;

  -- Comprehensive check for dependent records across ERP tables:
  BEGIN
    SELECT count(*) INTO v_marks_count FROM public.marks WHERE teacher_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      SELECT count(*) INTO v_marks_count FROM public.marks WHERE entered_by = p_user_id;
    EXCEPTION WHEN OTHERS THEN
      v_marks_count := 0;
    END;
  END;

  BEGIN
    SELECT count(*) INTO v_class_count FROM public.classes WHERE class_teacher_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_class_count := 0;
  END;

  BEGIN
    SELECT count(*) INTO v_assign_count FROM public.teacher_subjects WHERE teacher_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_assign_count := 0;
  END;
  
  BEGIN
    SELECT count(*) INTO v_attendance_count FROM public.teacher_attendance WHERE teacher_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      SELECT count(*) INTO v_attendance_count FROM public.teacher_attendance_logs WHERE teacher_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN
      v_attendance_count := 0;
    END;
  END;

  IF (v_marks_count > 0 OR v_class_count > 0 OR v_assign_count > 0 OR v_attendance_count > 0) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot permanently delete this user because active academic/teaching records exist (' ||
               v_marks_count || ' marks, ' || v_class_count || ' classes assigned, ' || v_attendance_count || ' attendance records). Please Deactivate the user instead to preserve historical records.'
    );
  END IF;

  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  BEGIN
    INSERT INTO public.user_management_audit_logs (
      admin_id, target_user_id, action, new_value
    ) VALUES (
      v_caller_id, p_user_id, 'USER_DELETED', json_build_object('deleted_user_id', p_user_id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('success', true, 'message', 'User permanently deleted successfully.');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 10. RPC: lookup_staff_email_by_name (With Ambiguity Detection)
DROP FUNCTION IF EXISTS public.lookup_staff_email_by_name CASCADE;
CREATE OR REPLACE FUNCTION public.lookup_staff_email_by_name(p_name TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
  v_status TEXT;
  v_clean TEXT;
  v_exact_count INT;
  v_prefix_count INT;
BEGIN
  v_clean := trim(COALESCE(p_name, ''));
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  -- 1. Check exact matches first
  SELECT count(*) INTO v_exact_count
  FROM public.profiles
  WHERE lower(trim(name)) = lower(v_clean)
    AND role IN ('teacher', 'admin', 'principal', 'accountant', 'librarian', 'coordinator');

  IF v_exact_count > 1 THEN
    -- Ambiguity detected: Multiple staff have this exact name!
    RETURN json_build_object('ambiguous', true, 'count', v_exact_count);
  ELSIF v_exact_count = 1 THEN
    SELECT id, email, COALESCE(status, 'Active') INTO v_user_id, v_email, v_status
    FROM public.profiles
    WHERE lower(trim(name)) = lower(v_clean)
      AND role IN ('teacher', 'admin', 'principal', 'accountant', 'librarian', 'coordinator')
    LIMIT 1;

    IF v_user_id IS NOT NULL AND (v_email IS NULL OR v_email = '') THEN
      SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    END IF;

    RETURN json_build_object('email', v_email, 'status', v_status, 'user_id', v_user_id, 'ambiguous', false);
  END IF;

  -- 2. Check prefix / partial match (e.g. 'Pallavi' -> 'Pallavi Bakshi Gupta')
  SELECT count(*) INTO v_prefix_count
  FROM public.profiles
  WHERE (name ILIKE v_clean || '%' OR name ILIKE '% ' || v_clean || '%')
    AND role IN ('teacher', 'admin', 'principal', 'accountant', 'librarian', 'coordinator');

  IF v_prefix_count > 1 THEN
    -- Ambiguity detected: Multiple staff share this first name / prefix!
    RETURN json_build_object('ambiguous', true, 'count', v_prefix_count);
  ELSIF v_prefix_count = 1 THEN
    SELECT id, email, COALESCE(status, 'Active') INTO v_user_id, v_email, v_status
    FROM public.profiles
    WHERE (name ILIKE v_clean || '%' OR name ILIKE '% ' || v_clean || '%')
      AND role IN ('teacher', 'admin', 'principal', 'accountant', 'librarian', 'coordinator')
    LIMIT 1;

    IF v_user_id IS NOT NULL AND (v_email IS NULL OR v_email = '') THEN
      SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    END IF;

    RETURN json_build_object('email', v_email, 'status', v_status, 'user_id', v_user_id, 'ambiguous', false);
  END IF;

  RETURN NULL;
END;
$$;

-- 11. RPC: get_staff_credentials_directory
DROP FUNCTION IF EXISTS public.get_staff_credentials_directory CASCADE;
CREATE OR REPLACE FUNCTION public.get_staff_credentials_directory()
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  role TEXT,
  campus TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authentication required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'principal')
  ) THEN
    RAISE EXCEPTION 'Forbidden: Insufficient privileges.';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    COALESCE(p.email, u.email, '')::TEXT as email,
    p.role,
    COALESCE(p.campus, 'Senior School')::TEXT as campus,
    COALESCE(p.status, 'Active')::TEXT as status
  FROM public.profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  WHERE p.role IN ('teacher', 'principal', 'accountant', 'librarian', 'coordinator', 'admin')
  ORDER BY p.name ASC;
END;
$$;

-- Permissions Management
REVOKE ALL ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_update_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_update_user_credentials(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_credentials(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_set_user_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_delete_user_safe(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_safe(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_staff_credentials_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_credentials_directory() TO authenticated, service_role;

-- Allow anon to call lookup_staff_email_by_name exclusively for pre-login name resolution
GRANT EXECUTE ON FUNCTION public.lookup_staff_email_by_name(TEXT) TO anon, authenticated, service_role;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
