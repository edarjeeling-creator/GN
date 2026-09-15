-- ==============================================================================
-- FIX CAMPUS CONFUSION & ADMIN GEOFENCE MISMATCH MIGRATION
--
-- Solves:
-- 1. verify_and_record_teacher_attendance now authoritatively checks:
--    a. v_session.campus_id (explicitly set by Admin or Kiosk)
--    b. v_session.kiosk_id -> attendance_kiosks -> campus_id
--    c. Teacher's assigned primary campus (teacher_campus_assignments)
--    d. Defaults to 'SENIOR_SCHOOL' rather than blindly picking the first row in campuses
-- 2. generate_attendance_qr_session now accepts p_campus_id (TEXT, default 'SENIOR_SCHOOL')
--    allowing Admin display to explicitly broadcast Senior School vs Junior School
-- ==============================================================================

-- ==============================================================================
-- 0. Ensure all required columns exist on teacher_attendance table
-- ==============================================================================
ALTER TABLE public.teacher_attendance 
  ADD COLUMN IF NOT EXISTS working_hours TEXT,
  ADD COLUMN IF NOT EXISTS working_duration_seconds DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
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

-- ==============================================================================
-- 1. Cleanly drop previous function signatures to prevent parameter default & ambiguity conflicts (ERROR 42P13)
DROP FUNCTION IF EXISTS public.generate_attendance_qr_session(TEXT, INT, TEXT);
DROP FUNCTION IF EXISTS public.generate_attendance_qr_session(TEXT, INT);
DROP FUNCTION IF EXISTS public.generate_attendance_qr_session(TEXT);
DROP FUNCTION IF EXISTS public.verify_and_record_teacher_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT);

-- 2. AUTHORITATIVE generate_attendance_qr_session WITH CAMPUS SUPPORT
-- Note: With parameter defaults (p_expiry_seconds = 45, p_campus_id = 'SENIOR_SCHOOL'),
-- this single function gracefully handles 1-arg, 2-arg, and 3-arg calls from both SQL & PostgREST RPC.
CREATE OR REPLACE FUNCTION public.generate_attendance_qr_session(
  p_action_type TEXT,
  p_expiry_seconds INT DEFAULT 45,
  p_campus_id TEXT DEFAULT 'SENIOR_SCHOOL'
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
  v_target_campus RECORD;
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

  -- Resolve Target Campus (supports campus_id slug or UUID)
  IF p_campus_id IS NOT NULL THEN
    SELECT * INTO v_target_campus FROM public.campuses 
    WHERE campus_id = p_campus_id OR id::TEXT = p_campus_id
    LIMIT 1;
  END IF;

  IF v_target_campus.id IS NULL THEN
    SELECT * INTO v_target_campus FROM public.campuses 
    WHERE campus_id = 'SENIOR_SCHOOL'
    LIMIT 1;
  END IF;

  IF v_target_campus.id IS NULL THEN
    SELECT * INTO v_target_campus FROM public.campuses 
    ORDER BY (campus_id = 'SENIOR_SCHOOL') DESC, created_at ASC 
    LIMIT 1;
  END IF;

  -- Deactivate previous generic admin active sessions for same action type & campus
  UPDATE public.attendance_qr_sessions
  SET is_active = FALSE
  WHERE action_type = p_action_type AND is_active = TRUE AND kiosk_id IS NULL;

  v_token := 'GNQR_' || COALESCE(v_target_campus.campus_id, 'CAMPUS') || '_' || p_action_type || '_' || md5(gen_random_uuid()::TEXT || clock_timestamp()::TEXT);
  v_expires_at := NOW() + (v_expiry_sec || ' seconds')::INTERVAL;

  INSERT INTO public.attendance_qr_sessions (
    session_token, action_type, created_by, campus_id, expires_at, is_active, created_at
  )
  VALUES (
    v_token, p_action_type, auth.uid(), v_target_campus.id, v_expires_at, TRUE, NOW()
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'sessionId', v_session_id,
    'sessionToken', v_token,
    'actionType', p_action_type,
    'campusId', v_target_campus.campus_id,
    'campusName', v_target_campus.campus_name,
    'expiresAt', v_expires_at,
    'serverTime', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_attendance_qr_session(TEXT, INT, TEXT) TO authenticated;


-- 2. AUTHORITATIVE ATTENDANCE VERIFICATION RPC WITH ROBUST CAMPUS RESOLUTION
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
  v_max_accuracy DOUBLE PRECISION;
  v_distance_meters DOUBLE PRECISION;
  v_today DATE;
  v_now TIMESTAMPTZ;
  v_now_time_str TEXT;
  v_win_setting RECORD;
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
    RAISE EXCEPTION 'UNAUTHENTICATED: Please log in to mark attendance.';
  END IF;

  SELECT * INTO v_teacher_profile FROM public.profiles WHERE id = v_teacher_id;
  IF v_teacher_profile.id IS NULL OR (v_teacher_profile.role != 'teacher' AND v_teacher_profile.role != 'admin' AND v_teacher_profile.role != 'principal') THEN
    RAISE EXCEPTION 'ONLY_TEACHERS_PERMITTED: Only active teachers and school administrators can record teacher attendance.';
  END IF;

  IF p_action_type NOT IN ('CHECK_IN', 'CHECK_OUT') THEN
    RAISE EXCEPTION 'INVALID_ACTION_TYPE: Must be CHECK_IN or CHECK_OUT.';
  END IF;

  v_now := NOW();
  v_today := (v_now AT TIME ZONE 'Asia/Kolkata')::DATE;
  v_now_time_str := to_char(v_now AT TIME ZONE 'Asia/Kolkata', 'HH24:MI');

  -- Concurrency Guard
  PERFORM pg_advisory_xact_lock(hashtext('attendance_' || v_teacher_id::TEXT || '_' || v_today::TEXT));

  -- 1. Validate QR Session Token
  SELECT * INTO v_session FROM public.attendance_qr_sessions
  WHERE session_token = p_session_token;

  IF v_session.id IS NULL THEN
    INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
    VALUES (v_teacher_id, v_teacher_id, 'INVALID_TOKEN', p_action_type, 'Invalid attendance QR token presented: ' || COALESCE(p_session_token, 'null'));
    RAISE EXCEPTION 'INVALID_QR_TOKEN: The scanned QR token is invalid or does not exist.';
  END IF;

  IF v_session.action_type != p_action_type THEN
    RAISE EXCEPTION 'QR_ACTION_MISMATCH: Scanned code is for % but requested %.', v_session.action_type, p_action_type;
  END IF;

  IF v_session.is_active IS FALSE THEN
    RAISE EXCEPTION 'QR_ALREADY_USED: This QR token has already been consumed. Please scan the new live code.';
  END IF;

  IF v_now > v_session.expires_at THEN
    RAISE EXCEPTION 'QR_EXPIRED: Attendance QR code has expired. Please scan the newly generated code.';
  END IF;

  -- 2. Authoritative Campus Resolution Hierarchy
  -- Step A: Directly from session record (if set by Admin display or Kiosk session)
  IF v_session.campus_id IS NOT NULL THEN
    SELECT * INTO v_campus FROM public.campuses WHERE id = v_session.campus_id AND status = 'ACTIVE';
  END IF;

  -- Step B: If session.campus_id was null, check via kiosk binding
  IF v_campus.id IS NULL AND v_session.kiosk_id IS NOT NULL THEN
    SELECT c.* INTO v_campus
    FROM public.campuses c
    JOIN public.attendance_kiosks k ON k.campus_id = c.id
    WHERE k.id = v_session.kiosk_id AND k.status = 'ACTIVE' AND c.status = 'ACTIVE';
  END IF;

  -- Step C: Fallback to Senior School
  IF v_campus.id IS NULL THEN
    SELECT * INTO v_campus FROM public.campuses WHERE campus_id = 'SENIOR_SCHOOL' AND status = 'ACTIVE';
  END IF;

  -- Step D: Final fallback to any active campus
  IF v_campus.id IS NULL THEN
    SELECT * INTO v_campus FROM public.campuses WHERE status = 'ACTIVE' ORDER BY (campus_id = 'SENIOR_SCHOOL') DESC, created_at ASC LIMIT 1;
  END IF;

  IF v_campus.id IS NULL THEN
    RAISE EXCEPTION 'CAMPUS_INACTIVE: No active campus found in the system.';
  END IF;

  -- 3. Verify Teacher Campus Authorization
  -- Leadership has roaming authority
  IF v_teacher_profile.role NOT IN ('admin', 'principal') THEN
    SELECT COUNT(*) INTO v_assignment_count
    FROM public.teacher_campus_assignments
    WHERE teacher_id = v_teacher_id
      AND active = TRUE
      AND (valid_from IS NULL OR valid_from <= v_today)
      AND (valid_until IS NULL OR valid_until >= v_today);

    IF v_assignment_count > 0 THEN
      SELECT * INTO v_assignment 
      FROM public.teacher_campus_assignments
      WHERE teacher_id = v_teacher_id
        AND campus_id = v_campus.id
        AND active = TRUE
        AND (valid_from IS NULL OR valid_from <= v_today)
        AND (valid_until IS NULL OR valid_until >= v_today);

      IF v_assignment.id IS NULL THEN
        INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
        VALUES (v_teacher_id, v_teacher_id, 'UNAUTHORIZED_CAMPUS', p_action_type, 
          'Cross-campus violation: Teacher attempted scan at ' || v_campus.campus_name || ' without campus authorization');
        RAISE EXCEPTION 'UNAUTHORIZED_CAMPUS: You are not authorized to mark attendance at %. You must scan at your assigned campus.', v_campus.campus_name;
      END IF;
    END IF;
  END IF;

  -- 4. Geolocation Validation
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'LOCATION_REQUIRED: GPS coordinates are required for attendance verification.';
  END IF;

  v_max_accuracy := COALESCE(v_campus.max_gps_accuracy_meters, 50.0);
  IF p_accuracy IS NOT NULL AND p_accuracy > v_max_accuracy THEN
    INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
    VALUES (v_teacher_id, v_teacher_id, 'POOR_GPS_ACCURACY', p_action_type, 
      'GPS accuracy ' || ROUND(p_accuracy::NUMERIC, 1) || 'm exceeded threshold ' || v_max_accuracy || 'm at ' || v_campus.campus_name);
    RAISE EXCEPTION 'GPS_ACCURACY_INSUFFICIENT: GPS accuracy of %m is too poor (must be within %m). Please wait for better satellite fix.', ROUND(p_accuracy::NUMERIC, 1), v_max_accuracy;
  END IF;

  -- 5. Server-Side Haversine Calculation
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

  -- 6. Validate Time Windows
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

  -- 7. Enforce State Machine & Mutate Record
  SELECT * INTO v_record FROM public.teacher_attendance
  WHERE teacher_id = v_teacher_id AND attendance_date = v_today;

  IF p_action_type = 'CHECK_IN' THEN
    IF v_record.id IS NOT NULL AND v_record.check_in_time IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_CHECKED_IN';
    END IF;

    BEGIN
      SELECT setting_value INTO v_reporting_time FROM public.school_settings WHERE setting_key = 'staff_reporting_time';
    EXCEPTION WHEN OTHERS THEN
      v_reporting_time := '08:45';
    END;

    BEGIN
      SELECT setting_value::INT INTO v_grace_mins FROM public.school_settings WHERE setting_key = 'staff_grace_period_mins';
    EXCEPTION WHEN OTHERS THEN
      v_grace_mins := 10;
    END;
    
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
    ON CONFLICT (teacher_id, attendance_date) 
    DO UPDATE SET
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
      check_in_qr_session_id = v_session.id,
      recorded_at = v_now;

  ELSIF p_action_type = 'CHECK_OUT' THEN
    IF v_record.id IS NULL OR v_record.check_in_time IS NULL THEN
      RAISE EXCEPTION 'NO_CHECK_IN_FOUND';
    END IF;

    IF v_record.check_out_time IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_CHECKED_OUT';
    END IF;

    v_duration_seconds := EXTRACT(EPOCH FROM (v_now - v_record.check_in_time));
    v_working_hours_str := to_char(INTERVAL '1 second' * v_duration_seconds, 'HH24:MI:SS');

    UPDATE public.teacher_attendance
    SET
      check_out_time = v_now,
      check_out_method = 'DYNAMIC_QR',
      check_out_verification_status = 'VERIFIED',
      check_out_lat = p_lat,
      check_out_lng = p_lng,
      check_out_distance_meters = v_distance_meters,
      gps_accuracy = p_accuracy,
      check_out_qr_session_id = v_session.id,
      working_hours = v_working_hours_str,
      working_duration_seconds = v_duration_seconds,
      updated_at = v_now
    WHERE id = v_record.id;

    v_status := v_record.status;
  END IF;

  -- 8. Audit and Invalidate One-Time QR Token
  UPDATE public.attendance_qr_sessions
  SET is_active = FALSE
  WHERE id = v_session.id;

  INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
  VALUES (
    v_teacher_id, v_teacher_id, 'DYNAMIC_QR_SCAN', p_action_type,
    'Verified ' || p_action_type || ' at ' || v_campus.campus_name || ' (distance ' || ROUND(v_distance_meters::NUMERIC, 1) || 'm, accuracy ' || ROUND(COALESCE(p_accuracy, 0)::NUMERIC, 1) || 'm)'
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', p_action_type,
    'status', v_status,
    'campusId', v_campus.campus_id,
    'campusName', v_campus.campus_name,
    'checkInTime', CASE WHEN p_action_type = 'CHECK_IN' THEN v_now ELSE v_record.check_in_time END,
    'checkOutTime', CASE WHEN p_action_type = 'CHECK_OUT' THEN v_now ELSE NULL END,
    'workingHours', v_working_hours_str,
    'distanceMeters', ROUND(v_distance_meters::NUMERIC, 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_record_teacher_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;
