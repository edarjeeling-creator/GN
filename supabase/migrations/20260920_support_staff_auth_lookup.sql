-- ==============================================================================
-- GYANODAY NIKETAN ERP: NON-TEACHING & GROUP D AUTHENTICATION & USER CREATION FIX
-- File: supabase/migrations/20260920_support_staff_auth_lookup.sql
-- Fixes: "Invalid role selected." when creating Non-Teaching or Group D staff
-- ==============================================================================

-- 1. UPDATE RPC: admin_create_user
-- Expands allowed roles to include 'non_teaching', 'group_d', and 'staff'
DROP FUNCTION IF EXISTS public.admin_create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) CASCADE;
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

  -- Server-side Role Check: Admin or Principal
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

  -- ALLOW ALL VALID ROLES INCLUDING NON-TEACHING AND GROUP D
  IF v_clean_role NOT IN (
    'teacher', 'admin', 'principal', 'accountant', 'librarian', 
    'coordinator', 'non_teaching', 'group_d', 'staff'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid role selected: ' || v_clean_role);
  END IF;

  -- Role Escalation Protection
  IF v_clean_role = 'superadmin' THEN
    RETURN json_build_object('success', false, 'error', 'Forbidden. Superadmin accounts cannot be created via the interface.');
  END IF;
  IF v_clean_role = 'admin' AND v_caller_role <> 'superadmin' THEN
    RETURN json_build_object('success', false, 'error', 'Forbidden. Only a Super Administrator can create new Administrator accounts.');
  END IF;

  -- Duplicate email check
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
    RETURN json_build_object('success', false, 'error', 'An account with email "' || v_clean_email || '" already exists.');
  END IF;

  v_user_id := gen_random_uuid();

  -- 1. Insert into auth.users
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

  -- 2. Wire up auth.identities
  IF EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
    UPDATE auth.identities
    SET identity_data = jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email, 'email_verified', true, 'phone_verified', false),
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
      jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email, 'email_verified', true, 'phone_verified', false),
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

  -- 4. Audit log
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

GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role;


-- 2. UPDATE RPC: lookup_staff_email_by_name
-- Allows Non-Teaching & Group D staff to log in using their Full Name or First Name
DROP FUNCTION IF EXISTS public.lookup_staff_email_by_name(TEXT) CASCADE;
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

  -- 1. Check exact matches first across all faculty and support staff roles
  SELECT count(*) INTO v_exact_count
  FROM public.profiles
  WHERE lower(trim(name)) = lower(v_clean)
    AND role IN ('teacher', 'admin', 'principal', 'accountant', 'librarian', 'coordinator', 'non_teaching', 'group_d', 'staff');

  IF v_exact_count > 1 THEN
    -- Ambiguity detected: Multiple staff have this exact name
    RETURN json_build_object('ambiguous', true, 'count', v_exact_count);
  ELSIF v_exact_count = 1 THEN
    SELECT id, email, COALESCE(status, 'Active') INTO v_user_id, v_email, v_status
    FROM public.profiles
    WHERE lower(trim(name)) = lower(v_clean)
      AND role IN ('teacher', 'admin', 'principal', 'accountant', 'librarian', 'coordinator', 'non_teaching', 'group_d', 'staff')
    LIMIT 1;

    IF v_user_id IS NOT NULL AND (v_email IS NULL OR v_email = '') THEN
      SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    END IF;

    RETURN json_build_object('email', v_email, 'status', v_status, 'user_id', v_user_id, 'ambiguous', false);
  END IF;

  -- 2. Check prefix / partial match (e.g. 'Rabi' -> 'Rabi Subba')
  SELECT count(*) INTO v_prefix_count
  FROM public.profiles
  WHERE (name ILIKE v_clean || '%' OR name ILIKE '% ' || v_clean || '%')
    AND role IN ('teacher', 'admin', 'principal', 'accountant', 'librarian', 'coordinator', 'non_teaching', 'group_d', 'staff');

  IF v_prefix_count > 1 THEN
    -- Ambiguity detected: Multiple staff share this first name / prefix
    RETURN json_build_object('ambiguous', true, 'count', v_prefix_count);
  ELSIF v_prefix_count = 1 THEN
    SELECT id, email, COALESCE(status, 'Active') INTO v_user_id, v_email, v_status
    FROM public.profiles
    WHERE (name ILIKE v_clean || '%' OR name ILIKE '% ' || v_clean || '%')
      AND role IN ('teacher', 'admin', 'principal', 'accountant', 'librarian', 'coordinator', 'non_teaching', 'group_d', 'staff')
    LIMIT 1;

    IF v_user_id IS NOT NULL AND (v_email IS NULL OR v_email = '') THEN
      SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    END IF;

    RETURN json_build_object('email', v_email, 'status', v_status, 'user_id', v_user_id, 'ambiguous', false);
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_staff_email_by_name(TEXT) TO anon, authenticated, service_role;


-- 3. UPDATE RPC: get_staff_credentials_directory
-- Returns all staff members including non_teaching and group_d
DROP FUNCTION IF EXISTS public.get_staff_credentials_directory() CASCADE;
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
  WHERE p.role IN ('teacher', 'principal', 'accountant', 'librarian', 'coordinator', 'admin', 'non_teaching', 'group_d', 'staff')
  ORDER BY p.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_credentials_directory() TO authenticated, service_role;
