-- ==============================================================================
-- IMMEDIATE FIX FOR: record "v_record" has no field "working_hours"
-- 
-- Instructions:
-- 1. Open Supabase Studio -> SQL Editor
-- 2. Paste this entire script
-- 3. Click RUN
-- ==============================================================================

-- 1. Ensure working_hours and all multi-campus columns exist on teacher_attendance table
ALTER TABLE public.teacher_attendance 
  ADD COLUMN IF NOT EXISTS working_hours TEXT,
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

-- 2. Update verify_and_record_teacher_attendance RPC with robust return values
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
  v_working_hours_str TEXT := NULL;
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

  -- 2. Verify and Consume QR Token Atomically
  SELECT s.* INTO v_session
  FROM public.attendance_qr_sessions s
  WHERE s.session_token = p_session_token
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_QR_TOKEN';
  END IF;

  IF v_session.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'QR_ALREADY_USED';
  END IF;

  IF v_session.expires_at < v_now THEN
    RAISE EXCEPTION 'QR_EXPIRED';
  END IF;

  IF v_session.action_type != p_action_type THEN
    RAISE EXCEPTION 'QR_ACTION_MISMATCH';
  END IF;

  -- 3. Resolve Authoritative Campus from Kiosk
  SELECT c.* INTO v_campus
  FROM public.campuses c
  JOIN public.attendance_kiosks k ON k.campus_id = c.id
  WHERE k.id = v_session.kiosk_id AND k.status = 'ACTIVE' AND c.status = 'ACTIVE';

  IF v_campus.id IS NULL THEN
    SELECT * INTO v_campus
    FROM public.campuses
    WHERE status = 'ACTIVE'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_campus.id IS NULL THEN
      RAISE EXCEPTION 'CAMPUS_INACTIVE: No active campus found.';
    END IF;
  END IF;

  -- 4. Verify Teacher's Campus Assignment
  SELECT COUNT(*) INTO v_assignment_count
  FROM public.teacher_campus_assignments
  WHERE teacher_id = v_teacher_id;

  IF v_assignment_count > 0 THEN
    SELECT * INTO v_assignment
    FROM public.teacher_campus_assignments
    WHERE teacher_id = v_teacher_id AND campus_id = v_campus.id;

    IF v_assignment.id IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED_CAMPUS: You are not authorized to mark attendance at %.', v_campus.campus_name;
    END IF;
  END IF;

  -- 5. Geolocation Validation
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

  -- 8. Enforce State Machine & Mutate Record
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
    'workingHours', v_working_hours_str,
    'serverTimestamp', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_record_teacher_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
