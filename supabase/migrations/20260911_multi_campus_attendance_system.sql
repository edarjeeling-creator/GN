-- ==============================================================================
-- GYANODAY NIKETAN ERP: UNIFIED MULTI-CAMPUS ATTENDANCE & KIOSK MIGRATION
-- Self-Contained, Idempotent Database Schema & RPC Architecture
-- Senior School & Junior School Multi-Campus Separation & Kiosk Binding
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. CAMPUSES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id TEXT UNIQUE NOT NULL, -- e.g. 'SENIOR_SCHOOL', 'JUNIOR_SCHOOL'
  campus_name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geofence_radius_meters DOUBLE PRECISION NOT NULL DEFAULT 150.0,
  max_gps_accuracy_meters DOUBLE PRECISION NOT NULL DEFAULT 50.0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read campuses" ON public.campuses;
CREATE POLICY "Allow authenticated read campuses"
  ON public.campuses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin all campuses" ON public.campuses;
CREATE POLICY "Allow admin all campuses"
  ON public.campuses FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'principal')
    )
  );

-- Seed Default Campuses (Configurable Darjeeling coordinates)
INSERT INTO public.campuses (
  campus_id, campus_name, latitude, longitude, geofence_radius_meters, max_gps_accuracy_meters, status
)
VALUES 
  (
    'SENIOR_SCHOOL', 
    'Senior School', 
    27.036007, 
    88.262672, 
    150.0, 
    50.0, 
    'ACTIVE'
  ),
  (
    'JUNIOR_SCHOOL', 
    'Junior School', 
    27.038500, 
    88.264500, 
    150.0, 
    50.0, 
    'ACTIVE'
  )
ON CONFLICT (campus_id) DO UPDATE SET
  campus_name = EXCLUDED.campus_name,
  geofence_radius_meters = EXCLUDED.geofence_radius_meters,
  status = EXCLUDED.status;

-- ------------------------------------------------------------------------------
-- 2. ATTENDANCE KIOSKS TABLE (PER-CAMPUS DEDICATED TABLETS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_kiosks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  device_name TEXT NOT NULL,
  location_name TEXT NOT NULL,
  kiosk_secret_hash TEXT NOT NULL,
  campus_id UUID REFERENCES public.campuses(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'INACTIVE')),
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.attendance_kiosks
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.campuses(id);

ALTER TABLE public.attendance_kiosks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read attendance_kiosks" ON public.attendance_kiosks;
CREATE POLICY "Allow authenticated read attendance_kiosks"
  ON public.attendance_kiosks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage attendance_kiosks" ON public.attendance_kiosks;
CREATE POLICY "Admin manage attendance_kiosks"
  ON public.attendance_kiosks FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'principal')
    )
  );

-- Seed Default Kiosks bound to Senior & Junior Campuses
DO $$
DECLARE
  v_senior_id UUID;
  v_junior_id UUID;
BEGIN
  SELECT id INTO v_senior_id FROM public.campuses WHERE campus_id = 'SENIOR_SCHOOL';
  SELECT id INTO v_junior_id FROM public.campuses WHERE campus_id = 'JUNIOR_SCHOOL';

  -- GN-SENIOR-001 -> Senior School
  INSERT INTO public.attendance_kiosks (
    device_id, device_name, location_name, campus_id, kiosk_secret_hash, status
  )
  VALUES (
    'GN-SENIOR-001',
    'Senior School Main Gate Kiosk',
    'Senior Campus Entrance',
    v_senior_id,
    -- SHA-256 of 'GyanodayKiosk@2026'
    '3405cada3c8bb5184f171e7c13894140d9da80f8c54d877a3f228acd6c88edf5',
    'ACTIVE'
  )
  ON CONFLICT (device_id) DO UPDATE SET
    campus_id = v_senior_id,
    kiosk_secret_hash = '3405cada3c8bb5184f171e7c13894140d9da80f8c54d877a3f228acd6c88edf5',
    status = 'ACTIVE';

  -- GN-JUNIOR-001 -> Junior School
  INSERT INTO public.attendance_kiosks (
    device_id, device_name, location_name, campus_id, kiosk_secret_hash, status
  )
  VALUES (
    'GN-JUNIOR-001',
    'Junior School Main Gate Kiosk',
    'Junior Campus Entrance',
    v_junior_id,
    -- SHA-256 of 'GyanodayKiosk@2026'
    '3405cada3c8bb5184f171e7c13894140d9da80f8c54d877a3f228acd6c88edf5',
    'ACTIVE'
  )
  ON CONFLICT (device_id) DO UPDATE SET
    campus_id = v_junior_id,
    kiosk_secret_hash = '3405cada3c8bb5184f171e7c13894140d9da80f8c54d877a3f228acd6c88edf5',
    status = 'ACTIVE';

  -- Update legacy GN-KIOSK-001 if exists
  UPDATE public.attendance_kiosks
  SET campus_id = v_senior_id
  WHERE device_id = 'GN-KIOSK-001' AND campus_id IS NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 3. TEACHER CAMPUS ASSIGNMENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_campus_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campus_id UUID NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT TRUE,
  active BOOLEAN DEFAULT TRUE,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(teacher_id, campus_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_campus_lookup 
  ON public.teacher_campus_assignments (teacher_id, campus_id, active);

ALTER TABLE public.teacher_campus_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read teacher_campus_assignments" ON public.teacher_campus_assignments;
CREATE POLICY "Allow authenticated read teacher_campus_assignments"
  ON public.teacher_campus_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin all teacher_campus_assignments" ON public.teacher_campus_assignments;
CREATE POLICY "Allow admin all teacher_campus_assignments"
  ON public.teacher_campus_assignments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'principal')
    )
  );

-- Auto-seed default assignments for active teachers to Senior School
DO $$
DECLARE
  v_senior_id UUID;
BEGIN
  SELECT id INTO v_senior_id FROM public.campuses WHERE campus_id = 'SENIOR_SCHOOL';
  IF v_senior_id IS NOT NULL THEN
    INSERT INTO public.teacher_campus_assignments (teacher_id, campus_id, is_primary, active)
    SELECT id, v_senior_id, TRUE, TRUE
    FROM public.profiles
    WHERE role = 'teacher' AND status = 'Active'
    ON CONFLICT (teacher_id, campus_id) DO NOTHING;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. ATTENDANCE DYNAMIC QR SESSIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_qr_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT NOT NULL UNIQUE,
  action_type TEXT NOT NULL CHECK (action_type IN ('CHECK_IN', 'CHECK_OUT')),
  created_by UUID REFERENCES auth.users(id),
  kiosk_id UUID REFERENCES public.attendance_kiosks(id),
  campus_id UUID REFERENCES public.campuses(id),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance_qr_sessions
  ADD COLUMN IF NOT EXISTS kiosk_id UUID REFERENCES public.attendance_kiosks(id),
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.campuses(id);

CREATE INDEX IF NOT EXISTS idx_attendance_qr_lookup 
  ON public.attendance_qr_sessions (session_token, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_session_campus
  ON public.attendance_qr_sessions (campus_id, is_active, expires_at);

ALTER TABLE public.attendance_qr_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read attendance_qr_sessions" ON public.attendance_qr_sessions;
CREATE POLICY "Allow authenticated read attendance_qr_sessions" 
  ON public.attendance_qr_sessions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin all attendance_qr_sessions" ON public.attendance_qr_sessions;
CREATE POLICY "Allow admin all attendance_qr_sessions" 
  ON public.attendance_qr_sessions FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'principal')
    )
  );

-- ------------------------------------------------------------------------------
-- 5. TEACHER ATTENDANCE TABLE EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Present',
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  working_hours TEXT,
  check_in_method TEXT DEFAULT 'DIRECT',
  check_out_method TEXT,
  check_in_verification_status TEXT DEFAULT 'UNVERIFIED',
  check_out_verification_status TEXT,
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION,
  check_in_distance_meters DOUBLE PRECISION,
  check_out_distance_meters DOUBLE PRECISION,
  check_in_qr_session_id UUID,
  check_out_qr_session_id UUID,
  campus_id UUID REFERENCES public.campuses(id),
  kiosk_id UUID REFERENCES public.attendance_kiosks(id),
  gps_accuracy DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, attendance_date)
);

ALTER TABLE public.teacher_attendance 
  ADD COLUMN IF NOT EXISTS check_in_method TEXT DEFAULT 'DIRECT',
  ADD COLUMN IF NOT EXISTS check_out_method TEXT,
  ADD COLUMN IF NOT EXISTS check_in_verification_status TEXT DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS check_out_verification_status TEXT,
  ADD COLUMN IF NOT EXISTS check_in_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_in_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_out_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_out_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_in_distance_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_out_distance_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_in_qr_session_id UUID,
  ADD COLUMN IF NOT EXISTS check_out_qr_session_id UUID,
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.campuses(id),
  ADD COLUMN IF NOT EXISTS kiosk_id UUID REFERENCES public.attendance_kiosks(id),
  ADD COLUMN IF NOT EXISTS gps_accuracy DOUBLE PRECISION;

ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read teacher_attendance" ON public.teacher_attendance;
CREATE POLICY "Allow authenticated read teacher_attendance" 
  ON public.teacher_attendance FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin all teacher_attendance" ON public.teacher_attendance;
CREATE POLICY "Allow admin all teacher_attendance" 
  ON public.teacher_attendance FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'principal')
    )
  );

-- ------------------------------------------------------------------------------
-- 6. ATTENDANCE AUDIT & GENERAL LOGS TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID,
  modified_by UUID REFERENCES public.profiles(id),
  original_status TEXT,
  new_status TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read attendance_audit_logs" ON public.attendance_audit_logs;
CREATE POLICY "Allow authenticated read attendance_audit_logs"
  ON public.attendance_audit_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin all attendance_audit_logs" ON public.attendance_audit_logs;
CREATE POLICY "Allow admin all attendance_audit_logs"
  ON public.attendance_audit_logs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'principal')
    )
  );

CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type TEXT,
  person_id UUID,
  scan_time TIMESTAMPTZ,
  status TEXT,
  device_name TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow authenticated read attendance_logs"
  ON public.attendance_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin all attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow admin all attendance_logs"
  ON public.attendance_logs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'principal')
    )
  );

-- ------------------------------------------------------------------------------
-- 7. ATTENDANCE CORRECTION REQUESTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('CHECK_IN', 'CHECK_OUT', 'FULL_DAY')),
  requested_time TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow teachers to view own correction requests" ON public.attendance_correction_requests;
CREATE POLICY "Allow teachers to view own correction requests"
  ON public.attendance_correction_requests FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'principal')
  ));

DROP POLICY IF EXISTS "Allow teachers to insert own correction requests" ON public.attendance_correction_requests;
CREATE POLICY "Allow teachers to insert own correction requests"
  ON public.attendance_correction_requests FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Allow admin to update correction requests" ON public.attendance_correction_requests;
CREATE POLICY "Allow admin to update correction requests"
  ON public.attendance_correction_requests FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'principal')
  ));

-- ------------------------------------------------------------------------------
-- 8. SCHOOL SETTINGS CONFIGURATION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read school_settings" ON public.school_settings;
CREATE POLICY "Allow authenticated read school_settings"
  ON public.school_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin all school_settings" ON public.school_settings;
CREATE POLICY "Allow admin all school_settings"
  ON public.school_settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'principal')
    )
  );

INSERT INTO public.school_settings (setting_key, setting_value, description)
VALUES 
  ('attendance_windows', '{"check_in_start": "06:00", "check_in_end": "12:00", "check_out_start": "13:00", "check_out_end": "19:00"}', 'Allowed time windows for Check-In and Check-Out'),
  ('staff_reporting_time', '"08:45"', 'Standard reporting time for staff'),
  ('staff_grace_period_mins', '10', 'Grace period in minutes before being marked Late')
ON CONFLICT (setting_key) DO UPDATE 
SET description = EXCLUDED.description;

-- ------------------------------------------------------------------------------
-- 9. KIOSK RPC: GENERATE DYNAMIC QR SESSION (MULTI-CAMPUS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kiosk_generate_qr_session(
  p_device_id TEXT,
  p_kiosk_secret TEXT,
  p_action_type TEXT,
  p_expiry_seconds INT DEFAULT 45
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_kiosk RECORD;
  v_campus RECORD;
  v_secret_hash TEXT;
  v_token TEXT;
  v_session_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_expiry_sec INT;
  v_checked_in INT := 0;
  v_checked_out INT := 0;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- 1. Validate device presence and ACTIVE status
  SELECT * INTO v_kiosk 
  FROM public.attendance_kiosks 
  WHERE device_id = p_device_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'UNAUTHORIZED_KIOSK: Device % not registered', p_device_id;
  END IF;

  IF v_kiosk.status != 'ACTIVE' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_KIOSK: Device % is %', p_device_id, v_kiosk.status;
  END IF;

  -- 2. Validate cryptographic credential hash (SHA-256)
  -- Uses PostgreSQL built-in sha256 (pg_catalog) with resilient fallback to pgcrypto digest
  BEGIN
    v_secret_hash := encode(sha256(p_kiosk_secret::bytea), 'hex');
  EXCEPTION WHEN undefined_function THEN
    BEGIN
      v_secret_hash := encode(extensions.digest(p_kiosk_secret::bytea, 'sha256'), 'hex');
    EXCEPTION WHEN undefined_function THEN
      v_secret_hash := encode(digest(p_kiosk_secret::bytea, 'sha256'), 'hex');
    END;
  END;

  IF v_secret_hash != v_kiosk.kiosk_secret_hash THEN
    RAISE EXCEPTION 'UNAUTHORIZED_KIOSK: Invalid credentials';
  END IF;

  -- 3. Resolve and validate associated campus
  IF v_kiosk.campus_id IS NULL THEN
    RAISE EXCEPTION 'KIOSK_CAMPUS_UNASSIGNED: Kiosk % is not associated with any campus', p_device_id;
  END IF;

  SELECT * INTO v_campus
  FROM public.campuses
  WHERE id = v_kiosk.campus_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CAMPUS_NOT_FOUND: Associated campus does not exist';
  END IF;

  IF v_campus.status != 'ACTIVE' THEN
    RAISE EXCEPTION 'CAMPUS_INACTIVE: Campus % is inactive', v_campus.campus_name;
  END IF;

  -- 4. Validate action type
  IF p_action_type NOT IN ('CHECK_IN', 'CHECK_OUT') THEN
    RAISE EXCEPTION 'INVALID_ACTION_TYPE: Must be CHECK_IN or CHECK_OUT';
  END IF;

  -- 5. Calculate clamped expiry (15s to 300s, default 45s)
  v_expiry_sec := COALESCE(p_expiry_seconds, 45);
  IF v_expiry_sec < 15 OR v_expiry_sec > 300 THEN
    v_expiry_sec := 45;
  END IF;

  -- 6. Deactivate previous active sessions for same kiosk and action type
  UPDATE public.attendance_qr_sessions
  SET is_active = FALSE
  WHERE kiosk_id = v_kiosk.id AND action_type = p_action_type AND is_active = TRUE;

  -- 7. Generate secure session token
  v_token := 'GNQR_' || v_campus.campus_id || '_' || p_action_type || '_' || md5(gen_random_uuid()::TEXT || clock_timestamp()::TEXT);
  v_expires_at := NOW() + (v_expiry_sec || ' seconds')::INTERVAL;

  INSERT INTO public.attendance_qr_sessions (
    session_token, action_type, created_by, kiosk_id, campus_id, expires_at, is_active, created_at
  )
  VALUES (
    v_token, p_action_type, NULL, v_kiosk.id, v_campus.id, v_expires_at, TRUE, NOW()
  )
  RETURNING id INTO v_session_id;

  -- 8. Update kiosk heartbeat
  UPDATE public.attendance_kiosks
  SET last_heartbeat = NOW()
  WHERE id = v_kiosk.id;

  -- 9. Fetch today's anonymous counters for this specific campus
  SELECT 
    COUNT(CASE WHEN check_in_time IS NOT NULL THEN 1 END),
    COUNT(CASE WHEN check_out_time IS NOT NULL THEN 1 END)
  INTO v_checked_in, v_checked_out
  FROM public.teacher_attendance
  WHERE attendance_date = v_today AND campus_id = v_campus.id;

  RETURN jsonb_build_object(
    'sessionId', v_session_id,
    'sessionToken', v_token,
    'actionType', p_action_type,
    'expiresAt', v_expires_at,
    'serverTime', NOW(),
    'deviceId', v_kiosk.device_id,
    'deviceName', v_kiosk.device_name,
    'campusId', v_campus.campus_id,
    'campusName', v_campus.campus_name,
    'locationName', v_kiosk.location_name,
    'checkedInCount', v_checked_in,
    'checkedOutCount', v_checked_out,
    'payloadString', json_build_object(
      'prefix', 'GN-ATT',
      'token', v_token,
      'action', p_action_type,
      'kiosk', v_kiosk.device_id,
      'campus', v_campus.campus_id,
      'campus_name', v_campus.campus_name,
      'created_at', NOW(),
      'expires_at', v_expires_at
    )::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_generate_qr_session(TEXT, TEXT, TEXT, INT) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 10. ADMIN/GENERIC QR GENERATION RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_attendance_qr_session(
  p_action_type TEXT,
  p_expiry_seconds INT DEFAULT 45
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_token TEXT;
  v_session_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_expiry_sec INT;
  v_senior_campus RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('admin', 'principal') THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ROLE';
  END IF;

  IF p_action_type NOT IN ('CHECK_IN', 'CHECK_OUT') THEN
    RAISE EXCEPTION 'INVALID_ACTION_TYPE';
  END IF;

  v_expiry_sec := COALESCE(p_expiry_seconds, 45);
  IF v_expiry_sec < 15 OR v_expiry_sec > 300 THEN
    v_expiry_sec := 45;
  END IF;

  SELECT * INTO v_senior_campus FROM public.campuses WHERE campus_id = 'SENIOR_SCHOOL';

  UPDATE public.attendance_qr_sessions
  SET is_active = FALSE
  WHERE action_type = p_action_type AND is_active = TRUE AND kiosk_id IS NULL;

  v_token := 'GNQR_' || p_action_type || '_' || md5(gen_random_uuid()::TEXT || clock_timestamp()::TEXT);
  v_expires_at := NOW() + (v_expiry_sec || ' seconds')::INTERVAL;

  INSERT INTO public.attendance_qr_sessions (
    session_token, action_type, created_by, campus_id, expires_at, is_active, created_at
  )
  VALUES (
    v_token, p_action_type, auth.uid(), v_senior_campus.id, v_expires_at, TRUE, NOW()
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'sessionId', v_session_id,
    'sessionToken', v_token,
    'actionType', p_action_type,
    'expiresAt', v_expires_at,
    'serverTime', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_attendance_qr_session(TEXT, INT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 11. TEACHER ATTENDANCE VERIFICATION RPC (MULTI-CAMPUS AUTHORITATIVE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_and_record_teacher_attendance(
  p_session_token TEXT,
  p_action_type TEXT,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_accuracy DOUBLE PRECISION DEFAULT NULL,
  p_device_info TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher_id UUID;
  v_teacher_profile RECORD;
  v_session RECORD;
  v_campus RECORD;
  v_assignment RECORD;
  v_assignment_count INT;
  v_win_setting RECORD;
  v_distance_meters DOUBLE PRECISION;
  v_max_accuracy DOUBLE PRECISION;
  v_today DATE;
  v_now TIMESTAMPTZ;
  v_now_time_str TEXT;
  v_win_in_start TEXT;
  v_win_in_end TEXT;
  v_win_out_start TEXT;
  v_win_out_end TEXT;
  v_reporting_time TEXT;
  v_grace_mins INT;
  v_status TEXT;
  v_record RECORD;
  v_working_hours_str TEXT;
  v_duration_seconds NUMERIC;
BEGIN
  -- 1. Authenticate caller
  v_teacher_id := auth.uid();
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_teacher_profile FROM public.profiles WHERE id = v_teacher_id;
  IF v_teacher_profile.id IS NULL OR v_teacher_profile.role NOT IN ('teacher', 'admin', 'principal') THEN
    RAISE EXCEPTION 'ONLY_TEACHERS_PERMITTED';
  END IF;

  IF p_action_type NOT IN ('CHECK_IN', 'CHECK_OUT') THEN
    RAISE EXCEPTION 'INVALID_ACTION_TYPE';
  END IF;

  v_now := NOW();
  v_today := (v_now AT TIME ZONE 'Asia/Kolkata')::DATE;
  v_now_time_str := to_char(v_now AT TIME ZONE 'Asia/Kolkata', 'HH24:MI');

  -- Concurrency Guard: Serialize simultaneous requests for same teacher on today's date
  PERFORM pg_advisory_xact_lock(hashtext('attendance_' || v_teacher_id::TEXT || '_' || v_today::TEXT));

  -- 2. Validate QR Session Token
  SELECT * INTO v_session FROM public.attendance_qr_sessions
  WHERE session_token = p_session_token;

  IF v_session.id IS NULL THEN
    INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
    VALUES (v_teacher_id, v_teacher_id, 'INVALID_TOKEN', p_action_type, 'Invalid attendance QR token presented: ' || COALESCE(p_session_token, 'null'));
    RAISE EXCEPTION 'INVALID_QR_TOKEN';
  END IF;

  IF v_session.action_type != p_action_type THEN
    RAISE EXCEPTION 'QR_ACTION_MISMATCH';
  END IF;

  IF v_session.is_active IS FALSE THEN
    RAISE EXCEPTION 'QR_ALREADY_USED';
  END IF;

  IF v_now > v_session.expires_at THEN
    RAISE EXCEPTION 'QR_EXPIRED';
  END IF;

  -- 3. Resolve Campus from trusted QR Session
  IF v_session.campus_id IS NULL THEN
    SELECT * INTO v_campus FROM public.campuses WHERE campus_id = 'SENIOR_SCHOOL';
  ELSE
    SELECT * INTO v_campus FROM public.campuses WHERE id = v_session.campus_id;
  END IF;

  IF v_campus.id IS NULL THEN
    RAISE EXCEPTION 'QR_CAMPUS_INVALID: Campus associated with QR code does not exist';
  END IF;

  IF v_campus.status != 'ACTIVE' THEN
    RAISE EXCEPTION 'CAMPUS_INACTIVE: Attendance for % is currently inactive', v_campus.campus_name;
  END IF;

  -- 4. Validate Teacher Campus Authorization
  -- Leadership (Director, Principal, Admin) has roaming authority across all active campuses
  IF v_teacher_profile.role IN ('admin', 'principal') THEN
    -- Leadership automatically authorized for roaming attendance at any active campus
    NULL;
  ELSE
    SELECT * INTO v_assignment 
    FROM public.teacher_campus_assignments
    WHERE teacher_id = v_teacher_id
      AND campus_id = v_campus.id
      AND active = TRUE
      AND (valid_from IS NULL OR valid_from <= v_today)
      AND (valid_until IS NULL OR valid_until >= v_today);

    IF v_assignment.id IS NULL THEN
      SELECT COUNT(*) INTO v_assignment_count
      FROM public.teacher_campus_assignments
      WHERE teacher_id = v_teacher_id
        AND active = TRUE
        AND (valid_from IS NULL OR valid_from <= v_today)
        AND (valid_until IS NULL OR valid_until >= v_today);

      IF v_assignment_count = 0 THEN
        INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
        VALUES (v_teacher_id, v_teacher_id, 'NO_CAMPUS_ASSIGNED', p_action_type, 'Teacher has no active campus assignment in ERP');
        RAISE EXCEPTION 'NO_ACTIVE_CAMPUS_ASSIGNMENT: You do not have an active campus assignment. Please contact administration.';
      ELSE
        INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
        VALUES (v_teacher_id, v_teacher_id, 'UNAUTHORIZED_CAMPUS', p_action_type, 
          'Cross-campus violation: Teacher attempted scan at ' || v_campus.campus_name || ' without campus authorization');
        RAISE EXCEPTION 'UNAUTHORIZED_CAMPUS: You are not authorized to mark attendance at %. You must scan at your assigned campus.', v_campus.campus_name;
      END IF;
    END IF;
  END IF;

  -- 5. Validate GPS Presence & Accuracy
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'LOCATION_REQUIRED: GPS coordinates are required to verify presence at %.', v_campus.campus_name;
  END IF;

  v_max_accuracy := COALESCE(v_campus.max_gps_accuracy_meters, 50.0);
  IF p_accuracy IS NOT NULL AND p_accuracy > v_max_accuracy THEN
    INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
    VALUES (v_teacher_id, v_teacher_id, 'POOR_GPS_ACCURACY', p_action_type, 
      'GPS accuracy ' || ROUND(p_accuracy::NUMERIC, 1) || 'm exceeded threshold ' || v_max_accuracy || 'm at ' || v_campus.campus_name);
    RAISE EXCEPTION 'GPS_ACCURACY_INSUFFICIENT: GPS accuracy of %m is too poor (must be within %m). Please wait for better satellite fix.', ROUND(p_accuracy::NUMERIC, 1), v_max_accuracy;
  END IF;

  -- 6. Server-Side Haversine Calculation
  v_distance_meters := 6371000 * 2 * asin(sqrt(
    power(sin(radians((p_lat - v_campus.latitude) / 2)), 2) +
    cos(radians(v_campus.latitude)) * cos(radians(p_lat)) *
    power(sin(radians((p_lng - v_campus.longitude) / 2)), 2)
  ));

  IF v_distance_meters > v_campus.geofence_radius_meters THEN
    INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
    VALUES (v_teacher_id, v_teacher_id, 'GEOFENCE_BREACH', p_action_type, 
      'Geofence violation at ' || v_campus.campus_name || ': distance ' || ROUND(v_distance_meters::NUMERIC, 1) || 'm exceeds radius ' || v_campus.geofence_radius_meters || 'm');
    RAISE EXCEPTION 'GEOFENCE_EXCEEDED: You are %m from % (allowed radius: %m). Please mark attendance inside school grounds.', 
      ROUND(v_distance_meters::NUMERIC, 1), v_campus.campus_name, v_campus.geofence_radius_meters;
  END IF;

  -- 7. Validate Time Windows
  SELECT setting_value INTO v_win_setting FROM public.school_settings WHERE setting_key = 'attendance_windows';
  IF v_win_setting.setting_value IS NOT NULL THEN
    v_win_in_start := COALESCE(v_win_setting.setting_value->>'check_in_start', '06:00');
    v_win_in_end := COALESCE(v_win_setting.setting_value->>'check_in_end', '12:00');
    v_win_out_start := COALESCE(v_win_setting.setting_value->>'check_out_start', '13:00');
    v_win_out_end := COALESCE(v_win_setting.setting_value->>'check_out_end', '19:00');

    IF p_action_type = 'CHECK_IN' AND (v_now_time_str < v_win_in_start OR v_now_time_str > v_win_in_end) THEN
      RAISE EXCEPTION 'CHECK_IN_WINDOW_CLOSED';
    END IF;

    IF p_action_type = 'CHECK_OUT' AND (v_now_time_str < v_win_out_start OR v_now_time_str > v_win_out_end) THEN
      RAISE EXCEPTION 'CHECK_OUT_WINDOW_CLOSED';
    END IF;
  END IF;

  -- 8. Enforce State Machine & Mutate Record
  SELECT * INTO v_record FROM public.teacher_attendance
  WHERE teacher_id = v_teacher_id AND attendance_date = v_today;

  IF p_action_type = 'CHECK_IN' THEN
    IF v_record.id IS NOT NULL AND v_record.check_in_time IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_CHECKED_IN';
    END IF;

    SELECT setting_value INTO v_reporting_time FROM public.school_settings WHERE setting_key = 'staff_reporting_time';
    SELECT setting_value::INT INTO v_grace_mins FROM public.school_settings WHERE setting_key = 'staff_grace_period_mins';
    
    v_reporting_time := COALESCE(v_reporting_time, '08:45');
    v_grace_mins := COALESCE(v_grace_mins, 10);

    IF v_now_time_str > to_char((v_reporting_time::TIME + (v_grace_mins || ' minutes')::INTERVAL), 'HH24:MI') THEN
      v_status := 'Late';
    ELSE
      v_status := 'Present';
    END IF;

    INSERT INTO public.teacher_attendance (
      teacher_id, attendance_date, status, check_in_time, 
      check_in_method, check_in_verification_status, 
      check_in_lat, check_in_lng, check_in_distance_meters,
      gps_accuracy, campus_id, kiosk_id,
      check_in_qr_session_id, recorded_at
    )
    VALUES (
      v_teacher_id, v_today, v_status, v_now,
      'DYNAMIC_QR', 'VERIFIED',
      p_lat, p_lng, v_distance_meters,
      p_accuracy, v_campus.id, v_session.kiosk_id,
      v_session.id, v_now
    )
    ON CONFLICT (teacher_id, attendance_date) DO UPDATE
    SET 
      check_in_time = v_now,
      status = v_status,
      check_in_method = 'DYNAMIC_QR',
      check_in_verification_status = 'VERIFIED',
      check_in_lat = p_lat,
      check_in_lng = p_lng,
      check_in_distance_meters = v_distance_meters,
      gps_accuracy = p_accuracy,
      campus_id = v_campus.id,
      kiosk_id = v_session.kiosk_id,
      check_in_qr_session_id = v_session.id
    RETURNING * INTO v_record;

    INSERT INTO public.attendance_logs (person_type, person_id, scan_time, status, device_name, remarks)
    VALUES ('teacher', v_teacher_id, v_now, v_status, COALESCE(p_device_info, 'Teacher Mobile (Verified QR)'), 
      'Dynamic QR Check-In Verified at ' || v_campus.campus_name || ' (' || ROUND(v_distance_meters::NUMERIC, 1) || 'm)');

  ELSIF p_action_type = 'CHECK_OUT' THEN
    IF v_record.id IS NULL OR v_record.check_in_time IS NULL THEN
      RAISE EXCEPTION 'NO_CHECK_IN_FOUND';
    END IF;

    IF v_record.check_out_time IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_CHECKED_OUT';
    END IF;

    v_duration_seconds := EXTRACT(EPOCH FROM (v_now - v_record.check_in_time));
    v_working_hours_str := to_char(INTERVAL '1 second' * v_duration_seconds, 'HH24h MIm');

    UPDATE public.teacher_attendance
    SET 
      check_out_time = v_now,
      check_out_method = 'DYNAMIC_QR',
      check_out_verification_status = 'VERIFIED',
      check_out_lat = p_lat,
      check_out_lng = p_lng,
      check_out_distance_meters = v_distance_meters,
      gps_accuracy = p_accuracy,
      campus_id = v_campus.id,
      kiosk_id = v_session.kiosk_id,
      check_out_qr_session_id = v_session.id,
      working_hours = v_working_hours_str
    WHERE id = v_record.id
    RETURNING * INTO v_record;

    INSERT INTO public.attendance_logs (person_type, person_id, scan_time, status, device_name, remarks)
    VALUES ('teacher', v_teacher_id, v_now, 'Checked Out', COALESCE(p_device_info, 'Teacher Mobile (Verified QR)'), 
      'Dynamic QR Check-Out Verified at ' || v_campus.campus_name || '. Duration: ' || v_working_hours_str);
  END IF;

  -- 9. Consume QR Token
  UPDATE public.attendance_qr_sessions
  SET is_active = FALSE
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'action', p_action_type,
    'recordId', v_record.id,
    'status', v_record.status,
    'campusId', v_campus.campus_id,
    'campusName', v_campus.campus_name,
    'checkInTime', v_record.check_in_time,
    'checkOutTime', v_record.check_out_time,
    'distanceMeters', ROUND(v_distance_meters::NUMERIC, 1),
    'accuracyMeters', ROUND(p_accuracy::NUMERIC, 1),
    'workingHours', v_record.working_hours,
    'serverTimestamp', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_record_teacher_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 12. ADMIN MANAGEMENT RPCS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_manage_campuses(
  p_action TEXT,
  p_campus_id TEXT DEFAULT NULL,
  p_campus_name TEXT DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_radius_meters DOUBLE PRECISION DEFAULT NULL,
  p_max_accuracy DOUBLE PRECISION DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('admin', 'principal') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Administrative role required';
  END IF;

  CASE p_action
    WHEN 'LIST' THEN
      SELECT COALESCE(json_agg(json_build_object(
        'id', id,
        'campus_id', campus_id,
        'campus_name', campus_name,
        'latitude', latitude,
        'longitude', longitude,
        'geofence_radius_meters', geofence_radius_meters,
        'max_gps_accuracy_meters', max_gps_accuracy_meters,
        'status', status,
        'updated_at', updated_at
      ) ORDER BY campus_name ASC), '[]'::JSON) INTO v_result
      FROM public.campuses;

      RETURN jsonb_build_object('success', true, 'campuses', v_result);

    WHEN 'UPDATE' THEN
      IF p_campus_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETERS: campus_id required';
      END IF;

      UPDATE public.campuses
      SET 
        campus_name = COALESCE(p_campus_name, campus_name),
        latitude = COALESCE(p_latitude, latitude),
        longitude = COALESCE(p_longitude, longitude),
        geofence_radius_meters = COALESCE(p_radius_meters, geofence_radius_meters),
        max_gps_accuracy_meters = COALESCE(p_max_accuracy, max_gps_accuracy_meters),
        status = COALESCE(p_status, status),
        updated_at = NOW()
      WHERE campus_id = p_campus_id;

      RETURN jsonb_build_object('success', true, 'campus_id', p_campus_id);

    WHEN 'CREATE' THEN
      IF p_campus_id IS NULL OR p_campus_name IS NULL OR p_latitude IS NULL OR p_longitude IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETERS: campus_id, campus_name, latitude, and longitude required';
      END IF;

      INSERT INTO public.campuses (
        campus_id, campus_name, latitude, longitude, geofence_radius_meters, max_gps_accuracy_meters, status
      )
      VALUES (
        p_campus_id, p_campus_name, p_latitude, p_longitude,
        COALESCE(p_radius_meters, 150.0),
        COALESCE(p_max_accuracy, 50.0),
        COALESCE(p_status, 'ACTIVE')
      )
      ON CONFLICT (campus_id) DO UPDATE SET
        campus_name = EXCLUDED.campus_name,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        geofence_radius_meters = EXCLUDED.geofence_radius_meters,
        status = EXCLUDED.status,
        updated_at = NOW();

      RETURN jsonb_build_object('success', true, 'campus_id', p_campus_id);

    ELSE
      RAISE EXCEPTION 'UNKNOWN_ACTION: %', p_action;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_manage_campuses(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_manage_teacher_assignments(
  p_action TEXT,
  p_teacher_id UUID DEFAULT NULL,
  p_campus_id UUID DEFAULT NULL,
  p_is_primary BOOLEAN DEFAULT TRUE,
  p_active BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('admin', 'principal') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Administrative role required';
  END IF;

  CASE p_action
    WHEN 'LIST' THEN
      SELECT COALESCE(json_agg(json_build_object(
        'id', a.id,
        'teacher_id', a.teacher_id,
        'teacher_name', p.name,
        'teacher_email', p.email,
        'campus_id', a.campus_id,
        'campus_code', c.campus_id,
        'campus_name', c.campus_name,
        'is_primary', a.is_primary,
        'active', a.active,
        'created_at', a.created_at
      ) ORDER BY p.name ASC), '[]'::JSON) INTO v_result
      FROM public.teacher_campus_assignments a
      JOIN public.profiles p ON p.id = a.teacher_id
      JOIN public.campuses c ON c.id = a.campus_id;

      RETURN jsonb_build_object('success', true, 'assignments', v_result);

    WHEN 'ASSIGN' THEN
      IF p_teacher_id IS NULL OR p_campus_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETERS: teacher_id and campus_id required';
      END IF;

      INSERT INTO public.teacher_campus_assignments (
        teacher_id, campus_id, is_primary, active, created_by
      )
      VALUES (
        p_teacher_id, p_campus_id, COALESCE(p_is_primary, TRUE), COALESCE(p_active, TRUE), auth.uid()
      )
      ON CONFLICT (teacher_id, campus_id) DO UPDATE SET
        is_primary = EXCLUDED.is_primary,
        active = EXCLUDED.active;

      RETURN jsonb_build_object('success', true, 'teacher_id', p_teacher_id, 'campus_id', p_campus_id);

    WHEN 'REVOKE' THEN
      IF p_teacher_id IS NULL OR p_campus_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETERS: teacher_id and campus_id required';
      END IF;

      UPDATE public.teacher_campus_assignments
      SET active = FALSE
      WHERE teacher_id = p_teacher_id AND campus_id = p_campus_id;

      RETURN jsonb_build_object('success', true, 'teacher_id', p_teacher_id, 'revoked', true);

    WHEN 'DELETE' THEN
      IF p_teacher_id IS NULL OR p_campus_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETERS: teacher_id and campus_id required';
      END IF;

      DELETE FROM public.teacher_campus_assignments
      WHERE teacher_id = p_teacher_id AND campus_id = p_campus_id;

      RETURN jsonb_build_object('success', true, 'teacher_id', p_teacher_id, 'deleted', true);

    ELSE
      RAISE EXCEPTION 'UNKNOWN_ACTION: %', p_action;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_manage_teacher_assignments(TEXT, UUID, UUID, BOOLEAN, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_manage_kiosks(
  p_action TEXT,
  p_device_id TEXT DEFAULT NULL,
  p_device_name TEXT DEFAULT NULL,
  p_location_name TEXT DEFAULT NULL,
  p_campus_id UUID DEFAULT NULL,
  p_secret_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_hash TEXT;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('admin', 'principal') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Administrative role required';
  END IF;

  CASE p_action
    WHEN 'LIST' THEN
      SELECT COALESCE(json_agg(json_build_object(
        'id', k.id,
        'device_id', k.device_id,
        'device_name', k.device_name,
        'location_name', k.location_name,
        'campus_id', k.campus_id,
        'campus_name', c.campus_name,
        'campus_code', c.campus_id,
        'status', k.status,
        'last_heartbeat', k.last_heartbeat,
        'created_at', k.created_at
      ) ORDER BY k.created_at DESC), '[]'::JSON) INTO v_result
      FROM public.attendance_kiosks k
      LEFT JOIN public.campuses c ON c.id = k.campus_id;

      RETURN jsonb_build_object('success', true, 'kiosks', v_result);

    WHEN 'REGISTER' THEN
      IF p_device_id IS NULL OR p_secret_key IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETERS: device_id and secret_key required';
      END IF;

      BEGIN
        v_hash := encode(sha256(p_secret_key::bytea), 'hex');
      EXCEPTION WHEN undefined_function THEN
        BEGIN
          v_hash := encode(extensions.digest(p_secret_key::bytea, 'sha256'), 'hex');
        EXCEPTION WHEN undefined_function THEN
          v_hash := encode(digest(p_secret_key::bytea, 'sha256'), 'hex');
        END;
      END;

      INSERT INTO public.attendance_kiosks (
        device_id, device_name, location_name, campus_id, kiosk_secret_hash, status, created_by
      )
      VALUES (
        p_device_id,
        COALESCE(p_device_name, 'Kiosk ' || p_device_id),
        COALESCE(p_location_name, 'School Campus'),
        p_campus_id,
        v_hash,
        'ACTIVE',
        auth.uid()
      )
      ON CONFLICT (device_id) DO UPDATE SET
        device_name = EXCLUDED.device_name,
        location_name = EXCLUDED.location_name,
        campus_id = COALESCE(EXCLUDED.campus_id, attendance_kiosks.campus_id),
        kiosk_secret_hash = EXCLUDED.kiosk_secret_hash,
        status = 'ACTIVE';

      RETURN jsonb_build_object('success', true, 'device_id', p_device_id, 'status', 'ACTIVE');

    WHEN 'ASSIGN_CAMPUS' THEN
      IF p_device_id IS NULL OR p_campus_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETERS: device_id and campus_id required';
      END IF;

      UPDATE public.attendance_kiosks
      SET campus_id = p_campus_id
      WHERE device_id = p_device_id;

      RETURN jsonb_build_object('success', true, 'device_id', p_device_id, 'campus_id', p_campus_id);

    WHEN 'REVOKE' THEN
      IF p_device_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETERS: device_id required';
      END IF;

      UPDATE public.attendance_kiosks
      SET status = 'REVOKED'
      WHERE device_id = p_device_id;

      RETURN jsonb_build_object('success', true, 'device_id', p_device_id, 'status', 'REVOKED');

    WHEN 'ACTIVATE' THEN
      IF p_device_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETERS: device_id required';
      END IF;

      UPDATE public.attendance_kiosks
      SET status = 'ACTIVE'
      WHERE device_id = p_device_id;

      RETURN jsonb_build_object('success', true, 'device_id', p_device_id, 'status', 'ACTIVE');

    WHEN 'DELETE' THEN
      IF p_device_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETERS: device_id required';
      END IF;

      DELETE FROM public.attendance_kiosks
      WHERE device_id = p_device_id;

      RETURN jsonb_build_object('success', true, 'device_id', p_device_id, 'deleted', true);

    ELSE
      RAISE EXCEPTION 'UNKNOWN_ACTION: %', p_action;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_manage_kiosks(TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
