-- ==============================================================================
-- GYANODAY NIKETAN ERP: VERIFIED HYBRID TEACHER ATTENDANCE SYSTEM MIGRATION
-- ==============================================================================

-- 1. EXTEND TEACHER_ATTENDANCE TABLE SAFELY
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
  ADD COLUMN IF NOT EXISTS check_out_qr_session_id UUID;

-- 2. CREATE DYNAMIC QR SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.attendance_qr_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT NOT NULL UNIQUE,
  action_type TEXT NOT NULL CHECK (action_type IN ('CHECK_IN', 'CHECK_OUT')),
  created_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_qr_lookup 
  ON public.attendance_qr_sessions (session_token, is_active, expires_at);

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

-- 3. CREATE ATTENDANCE CORRECTION REQUESTS TABLE
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

CREATE INDEX IF NOT EXISTS idx_corr_req_teacher_date 
  ON public.attendance_correction_requests (teacher_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_corr_req_status 
  ON public.attendance_correction_requests (status);

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

-- 4. CREATE ATTENDANCE AUDIT LOGS TABLE
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

-- 5. CONFIGURE DEFAULT SCHOOL SETTINGS FOR GEOFENCE & ATTENDANCE WINDOWS
INSERT INTO public.school_settings (setting_key, setting_value, description)
VALUES 
  ('attendance_location', '{"latitude": 27.036007, "longitude": 88.262672, "allowed_radius_meters": 150, "name": "Gyanoday Niketan Campus"}', 'GPS coordinates and allowed radius in meters for teacher attendance geofence'),
  ('attendance_windows', '{"check_in_start": "06:30", "check_in_end": "11:30", "check_out_start": "13:30", "check_out_end": "18:30"}', 'Allowed time windows for Check-In and Check-Out'),
  ('attendance_qr_config', '{"expiry_seconds": 45}', 'Dynamic QR expiration window in seconds')
ON CONFLICT (setting_key) DO UPDATE 
SET description = EXCLUDED.description;

-- 6. FUNCTION: GENERATE DYNAMIC QR SESSION
CREATE OR REPLACE FUNCTION public.generate_attendance_qr_session(
  p_action_type TEXT,
  p_expiry_seconds INT DEFAULT 45
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_token TEXT;
  v_session_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_expiry_sec INT;
BEGIN
  -- Authenticate caller
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('admin', 'principal') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only administrative roles can generate attendance QR sessions';
  END IF;

  IF p_action_type NOT IN ('CHECK_IN', 'CHECK_OUT') THEN
    RAISE EXCEPTION 'INVALID_ACTION_TYPE';
  END IF;

  v_expiry_sec := COALESCE(p_expiry_seconds, 45);
  IF v_expiry_sec < 15 OR v_expiry_sec > 300 THEN
    v_expiry_sec := 45;
  END IF;

  -- Deactivate previous active sessions for same action type to prevent stale token reuse
  UPDATE public.attendance_qr_sessions
  SET is_active = FALSE
  WHERE action_type = p_action_type AND is_active = TRUE;

  -- Generate secure token using md5 + random uuid + epoch microsecond
  v_token := 'GNQR_' || p_action_type || '_' || md5(gen_random_uuid()::TEXT || clock_timestamp()::TEXT);
  v_expires_at := NOW() + (v_expiry_sec || ' seconds')::INTERVAL;

  INSERT INTO public.attendance_qr_sessions (
    session_token, action_type, created_by, expires_at, is_active, created_at
  )
  VALUES (
    v_token, p_action_type, auth.uid(), v_expires_at, TRUE, NOW()
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

-- 6. FUNCTION: VERIFY AND RECORD TEACHER ATTENDANCE (ATOMIC SERVER AUTHORITY)
CREATE OR REPLACE FUNCTION public.verify_and_record_teacher_attendance(
  p_session_token TEXT,
  p_action_type TEXT,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_device_info TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id UUID;
  v_teacher_profile RECORD;
  v_session RECORD;
  v_loc_setting RECORD;
  v_win_setting RECORD;
  v_school_lat DOUBLE PRECISION;
  v_school_lng DOUBLE PRECISION;
  v_allowed_radius DOUBLE PRECISION;
  v_distance_meters DOUBLE PRECISION;
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
  v_teacher_id := auth.uid();
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_teacher_profile FROM public.profiles WHERE id = v_teacher_id;
  IF v_teacher_profile.id IS NULL OR v_teacher_profile.role != 'teacher' THEN
    -- Admins acting as teachers are also allowed
    IF v_teacher_profile.role != 'admin' THEN
      RAISE EXCEPTION 'ONLY_TEACHERS_PERMITTED';
    END IF;
  END IF;

  IF p_action_type NOT IN ('CHECK_IN', 'CHECK_OUT') THEN
    RAISE EXCEPTION 'INVALID_ACTION_TYPE';
  END IF;

  v_now := NOW();
  v_today := (v_now AT TIME ZONE 'Asia/Kolkata')::DATE;
  v_now_time_str := to_char(v_now AT TIME ZONE 'Asia/Kolkata', 'HH24:MI');

  -- Concurrency Guard: Serialize simultaneous requests for same teacher on today's date
  PERFORM pg_advisory_xact_lock(hashtext('attendance_' || v_teacher_id::TEXT || '_' || v_today::TEXT));

  -- 1. VALIDATE QR SESSION TOKEN
  SELECT * INTO v_session FROM public.attendance_qr_sessions
  WHERE session_token = p_session_token;

  IF v_session.id IS NULL THEN
    -- Audit suspicious invalid attempt
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

  -- 2. VALIDATE TIME WINDOWS FROM SCHOOL SETTINGS
  SELECT setting_value INTO v_win_setting FROM public.school_settings WHERE setting_key = 'attendance_windows';
  IF v_win_setting.setting_value IS NOT NULL THEN
    BEGIN
      v_win_in_start := COALESCE((v_win_setting.setting_value::jsonb)->>'check_in_start', '06:00');
      v_win_in_end := COALESCE((v_win_setting.setting_value::jsonb)->>'check_in_end', '12:00');
      v_win_out_start := COALESCE((v_win_setting.setting_value::jsonb)->>'check_out_start', '13:00');
      v_win_out_end := COALESCE((v_win_setting.setting_value::jsonb)->>'check_out_end', '19:00');
    EXCEPTION WHEN OTHERS THEN
      v_win_in_start := '06:00';
      v_win_in_end := '12:00';
      v_win_out_start := '13:00';
      v_win_out_end := '19:00';
    END;

    IF p_action_type = 'CHECK_IN' AND (v_now_time_str < v_win_in_start OR v_now_time_str > v_win_in_end) THEN
      RAISE EXCEPTION 'CHECK_IN_WINDOW_CLOSED';
    END IF;

    IF p_action_type = 'CHECK_OUT' AND (v_now_time_str < v_win_out_start OR v_now_time_str > v_win_out_end) THEN
      RAISE EXCEPTION 'CHECK_OUT_WINDOW_CLOSED';
    END IF;
  END IF;

  -- 3. VALIDATE GEOFENCE (AUTHORITATIVE SERVER VALIDATION)
  SELECT setting_value INTO v_loc_setting FROM public.school_settings WHERE setting_key = 'attendance_location';
  IF v_loc_setting.setting_value IS NOT NULL THEN
    BEGIN
      v_school_lat := ((v_loc_setting.setting_value::jsonb)->>'latitude')::DOUBLE PRECISION;
      v_school_lng := ((v_loc_setting.setting_value::jsonb)->>'longitude')::DOUBLE PRECISION;
      v_allowed_radius := COALESCE(((v_loc_setting.setting_value::jsonb)->>'allowed_radius_meters')::DOUBLE PRECISION, 150.0);
    EXCEPTION WHEN OTHERS THEN
      v_school_lat := NULL;
      v_school_lng := NULL;
      v_allowed_radius := 150.0;
    END;

    IF v_school_lat IS NOT NULL AND v_school_lng IS NOT NULL THEN
      IF p_lat IS NULL OR p_lng IS NULL THEN
        RAISE EXCEPTION 'LOCATION_REQUIRED: GPS location is required to verify attendance within campus geofence.';
      END IF;

      -- Haversine formula distance calculation in meters
      v_distance_meters := 6371000 * 2 * asin(sqrt(
        power(sin(radians((p_lat - v_school_lat) / 2)), 2) +
        cos(radians(v_school_lat)) * cos(radians(p_lat)) *
        power(sin(radians((p_lng - v_school_lng) / 2)), 2)
      ));

      IF v_distance_meters > v_allowed_radius THEN
        -- Log geofence breach
        INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
        VALUES (v_teacher_id, v_teacher_id, 'GEOFENCE_BREACH', p_action_type, 
          'Geofence violation: distance ' || ROUND(v_distance_meters::NUMERIC, 1) || 'm exceeds allowed ' || v_allowed_radius || 'm');
        RAISE EXCEPTION 'GEOFENCE_EXCEEDED';
      END IF;
    END IF;
  END IF;

  -- 4. ENFORCE STATE MACHINE & MUTATE ATTENDANCE RECORD ATOMICALLY
  SELECT * INTO v_record FROM public.teacher_attendance
  WHERE teacher_id = v_teacher_id AND attendance_date = v_today;

  IF p_action_type = 'CHECK_IN' THEN
    IF v_record.id IS NOT NULL AND v_record.check_in_time IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_CHECKED_IN';
    END IF;

    -- Calculate Late vs Present based on reporting time
    SELECT setting_value INTO v_reporting_time FROM public.school_settings WHERE setting_key = 'staff_reporting_time';
    SELECT setting_value::INT INTO v_grace_mins FROM public.school_settings WHERE setting_key = 'staff_grace_period_mins';
    
    v_reporting_time := COALESCE(v_reporting_time, '08:15');
    v_grace_mins := COALESCE(v_grace_mins, 10);

    -- Status determination: if current time > reporting_time + grace_period -> Late
    IF v_now_time_str > to_char((v_reporting_time::TIME + (v_grace_mins || ' minutes')::INTERVAL), 'HH24:MI') THEN
      v_status := 'Late';
    ELSE
      v_status := 'Present';
    END IF;

    -- Insert or update check-in
    INSERT INTO public.teacher_attendance (
      teacher_id, attendance_date, status, check_in_time, 
      check_in_method, check_in_verification_status, 
      check_in_lat, check_in_lng, check_in_distance_meters,
      check_in_qr_session_id, recorded_at
    )
    VALUES (
      v_teacher_id, v_today, v_status, v_now,
      'DYNAMIC_QR', 'VERIFIED',
      p_lat, p_lng, v_distance_meters,
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
      check_in_qr_session_id = v_session.id
    RETURNING * INTO v_record;

    -- Log attendance event
    INSERT INTO public.attendance_logs (person_type, person_id, scan_time, status, device_name, remarks)
    VALUES ('teacher', v_teacher_id, v_now, v_status, COALESCE(p_device_info, 'Teacher Mobile (Verified QR)'), 'Dynamic QR Check-In Verified');

  ELSIF p_action_type = 'CHECK_OUT' THEN
    IF v_record.id IS NULL OR v_record.check_in_time IS NULL THEN
      RAISE EXCEPTION 'NO_CHECK_IN_FOUND';
    END IF;

    IF v_record.check_out_time IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_CHECKED_OUT';
    END IF;

    -- Calculate total duration
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
      check_out_qr_session_id = v_session.id,
      working_hours = v_working_hours_str
    WHERE id = v_record.id
    RETURNING * INTO v_record;

    -- Log attendance event
    INSERT INTO public.attendance_logs (person_type, person_id, scan_time, status, device_name, remarks)
    VALUES ('teacher', v_teacher_id, v_now, 'Checked Out', COALESCE(p_device_info, 'Teacher Mobile (Verified QR)'), 'Dynamic QR Check-Out Verified. Duration: ' || v_working_hours_str);

  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'action', p_action_type,
    'recordId', v_record.id,
    'status', v_record.status,
    'checkInTime', v_record.check_in_time,
    'checkOutTime', v_record.check_out_time,
    'workingHours', v_record.working_hours,
    'verificationStatus', 'VERIFIED',
    'distanceMeters', v_distance_meters
  );
END;
$$;

-- 7. FUNCTION: SUBMIT ATTENDANCE CORRECTION REQUEST
CREATE OR REPLACE FUNCTION public.request_attendance_correction(
  p_attendance_date DATE,
  p_request_type TEXT,
  p_requested_time TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id UUID;
  v_req_id UUID;
BEGIN
  v_teacher_id := auth.uid();
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF TRIM(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED';
  END IF;

  INSERT INTO public.attendance_correction_requests (
    teacher_id, attendance_date, request_type, requested_time, reason, status
  )
  VALUES (
    v_teacher_id, p_attendance_date, p_request_type, p_requested_time, p_reason, 'PENDING'
  )
  RETURNING id INTO v_req_id;

  RETURN jsonb_build_object('success', TRUE, 'requestId', v_req_id);
END;
$$;

-- 8. FUNCTION: REVIEW ATTENDANCE CORRECTION REQUEST (ADMIN/COORDINATOR)
CREATE OR REPLACE FUNCTION public.review_attendance_correction(
  p_request_id UUID,
  p_action TEXT, -- 'APPROVE' or 'REJECT'
  p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer_id UUID;
  v_reviewer_role TEXT;
  v_req RECORD;
  v_att RECORD;
BEGIN
  v_reviewer_id := auth.uid();
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT role INTO v_reviewer_role FROM public.profiles WHERE id = v_reviewer_id;
  IF v_reviewer_role NOT IN ('admin', 'principal') THEN
    RAISE EXCEPTION 'UNAUTHORIZED_REVIEWER';
  END IF;

  SELECT * INTO v_req FROM public.attendance_correction_requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  IF v_req.status != 'PENDING' THEN
    RAISE EXCEPTION 'ALREADY_REVIEWED';
  END IF;

  IF p_action = 'APPROVE' THEN
    UPDATE public.attendance_correction_requests
    SET status = 'APPROVED', reviewed_by = v_reviewer_id, reviewed_at = NOW(), review_notes = p_review_notes, updated_at = NOW()
    WHERE id = p_request_id;

    -- Apply correction to teacher_attendance
    SELECT * INTO v_att FROM public.teacher_attendance 
    WHERE teacher_id = v_req.teacher_id AND attendance_date = v_req.attendance_date;

    IF v_req.request_type = 'CHECK_IN' THEN
      IF v_att.id IS NOT NULL THEN
        UPDATE public.teacher_attendance 
        SET check_in_time = COALESCE(v_req.requested_time, NOW()), 
            status = 'Present',
            check_in_method = 'APPROVED_CORRECTION',
            check_in_verification_status = 'MANUALLY_APPROVED'
        WHERE id = v_att.id;
      ELSE
        INSERT INTO public.teacher_attendance (teacher_id, attendance_date, status, check_in_time, check_in_method, check_in_verification_status)
        VALUES (v_req.teacher_id, v_req.attendance_date, 'Present', COALESCE(v_req.requested_time, NOW()), 'APPROVED_CORRECTION', 'MANUALLY_APPROVED');
      END IF;
    ELSIF v_req.request_type = 'CHECK_OUT' THEN
      IF v_att.id IS NOT NULL THEN
        UPDATE public.teacher_attendance 
        SET check_out_time = COALESCE(v_req.requested_time, NOW()),
            check_out_method = 'APPROVED_CORRECTION',
            check_out_verification_status = 'MANUALLY_APPROVED'
        WHERE id = v_att.id;
      END IF;
    ELSIF v_req.request_type = 'FULL_DAY' THEN
      IF v_att.id IS NOT NULL THEN
        UPDATE public.teacher_attendance 
        SET status = 'Present',
            check_in_verification_status = 'MANUALLY_APPROVED',
            check_out_verification_status = 'MANUALLY_APPROVED'
        WHERE id = v_att.id;
      ELSE
        INSERT INTO public.teacher_attendance (teacher_id, attendance_date, status, check_in_time, check_out_time, check_in_method, check_out_method, check_in_verification_status, check_out_verification_status)
        VALUES (v_req.teacher_id, v_req.attendance_date, 'Present', v_req.requested_time, v_req.requested_time + INTERVAL '7 hours', 'APPROVED_CORRECTION', 'APPROVED_CORRECTION', 'MANUALLY_APPROVED', 'MANUALLY_APPROVED');
      END IF;
    END IF;

    -- Audit Log
    INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
    VALUES (v_req.teacher_id, v_reviewer_id, 'PENDING_CORRECTION', 'APPROVED_CORRECTION', 'Approved correction request: ' || v_req.reason);

  ELSIF p_action = 'REJECT' THEN
    UPDATE public.attendance_correction_requests
    SET status = 'REJECTED', reviewed_by = v_reviewer_id, reviewed_at = NOW(), review_notes = p_review_notes, updated_at = NOW()
    WHERE id = p_request_id;

    -- Audit Log
    INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
    VALUES (v_req.teacher_id, v_reviewer_id, 'PENDING_CORRECTION', 'REJECTED_CORRECTION', 'Rejected correction request: ' || COALESCE(p_review_notes, 'No reason provided'));
  ELSE
    RAISE EXCEPTION 'INVALID_ACTION';
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'status', p_action);
END;
$$;

-- 9. RLS LOCKDOWN: PREVENT DIRECT UNAUTHORIZED MUTATIONS FROM CLIENT BROWSER
DROP POLICY IF EXISTS "Allow authenticated all teacher_attendance" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Allow authenticated read teacher_attendance" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Allow admin all teacher_attendance" ON public.teacher_attendance;

-- Authenticated users can view attendance
CREATE POLICY "Allow authenticated read teacher_attendance" 
  ON public.teacher_attendance FOR SELECT TO authenticated USING (true);

-- Only Admins and Principals can perform direct table mutations
CREATE POLICY "Allow admin all teacher_attendance" 
  ON public.teacher_attendance FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'principal')
    )
  );

-- Notify schema reload for PostgREST
NOTIFY pgrst, 'reload schema';
