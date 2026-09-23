-- ==============================================================================
-- GYANODAY NIKETAN ERP: NON-TEACHING & GROUP D STAFF ATTENDANCE & ROLE MIGRATION
-- Copy of supabase/migrations/20260920_support_staff_attendance_and_roles.sql
-- ==============================================================================

-- 1. Ensure designation column exists on public.profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS designation TEXT;

-- 2. Ensure RLS policies on teacher_attendance allow any authenticated user to view their own records
DROP POLICY IF EXISTS "Allow staff to view own attendance" ON public.teacher_attendance;
CREATE POLICY "Allow staff to view own attendance"
  ON public.teacher_attendance FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'principal', 'coordinator')
  ));

-- 3. Ensure RLS policies on attendance_correction_requests allow any staff to view and insert their own requests
DROP POLICY IF EXISTS "Allow staff to view own correction requests" ON public.attendance_correction_requests;
CREATE POLICY "Allow staff to view own correction requests"
  ON public.attendance_correction_requests FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'principal', 'coordinator')
  ));

DROP POLICY IF EXISTS "Allow staff to insert own correction requests" ON public.attendance_correction_requests;
CREATE POLICY "Allow staff to insert own correction requests"
  ON public.attendance_correction_requests FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

-- 4. AUTHORITATIVE ATTENDANCE VERIFICATION RPC SUPPORTING ALL STAFF ROLES
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
  v_now_local_time TIME;
  v_win_setting RECORD;
  v_win_in_start TEXT;
  v_win_in_end TEXT;
  v_win_out_start TEXT;
  v_win_out_end TEXT;
  v_rule RECORD;
  v_status TEXT;
  v_record RECORD;
  v_working_hours_str TEXT;
  v_duration_seconds NUMERIC;
  v_record_id UUID := NULL;
  v_rule_version INT := NULL;
  v_late_threshold_str TEXT := NULL;
  v_check_in_time TIMESTAMPTZ := NULL;
  v_check_out_time TIMESTAMPTZ := NULL;
BEGIN
  v_teacher_id := auth.uid();
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Please log in to mark attendance.';
  END IF;

  SELECT * INTO v_teacher_profile FROM public.profiles WHERE id = v_teacher_id;
  IF v_teacher_profile.id IS NULL OR (v_teacher_profile.role NOT IN (
    'teacher', 'admin', 'principal', 'coordinator', 'accountant', 'librarian', 'non_teaching', 'group_d', 'staff'
  )) THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ROLE: Only authorized faculty and staff members can record attendance.';
  END IF;

  IF p_action_type NOT IN ('CHECK_IN', 'CHECK_OUT') THEN
    RAISE EXCEPTION 'INVALID_ACTION_TYPE: Must be CHECK_IN or CHECK_OUT.';
  END IF;

  v_now := NOW();
  -- Local Indian Timezone (Asia/Kolkata)
  v_today := (v_now AT TIME ZONE 'Asia/Kolkata')::DATE;
  v_now_time_str := to_char(v_now AT TIME ZONE 'Asia/Kolkata', 'HH24:MI');
  v_now_local_time := (v_now AT TIME ZONE 'Asia/Kolkata')::TIME;

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
  IF v_session.campus_id IS NOT NULL THEN
    SELECT * INTO v_campus FROM public.campuses WHERE id = v_session.campus_id AND status = 'ACTIVE';
  END IF;

  IF v_campus.id IS NULL AND v_session.kiosk_id IS NOT NULL THEN
    SELECT c.* INTO v_campus
    FROM public.campuses c
    JOIN public.attendance_kiosks k ON k.campus_id = c.id
    WHERE k.id = v_session.kiosk_id AND k.status = 'ACTIVE' AND c.status = 'ACTIVE';
  END IF;

  IF v_campus.id IS NULL THEN
    SELECT * INTO v_campus FROM public.campuses WHERE campus_id = 'SENIOR_SCHOOL' AND status = 'ACTIVE';
  END IF;

  IF v_campus.id IS NULL THEN
    SELECT * INTO v_campus FROM public.campuses WHERE status = 'ACTIVE' ORDER BY (campus_id = 'SENIOR_SCHOOL') DESC, created_at ASC LIMIT 1;
  END IF;

  IF v_campus.id IS NULL THEN
    RAISE EXCEPTION 'CAMPUS_INACTIVE: No active campus found in the system.';
  END IF;

  -- 3. Verify Staff Campus Authorization (Leadership has roaming authority)
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
          'Cross-campus violation: Staff member attempted scan at ' || v_campus.campus_name || ' without campus authorization');
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

  -- 7. Enforce State Machine & Authoritative Status Calculation
  SELECT * INTO v_record FROM public.teacher_attendance
  WHERE teacher_id = v_teacher_id AND attendance_date = v_today;

  IF p_action_type = 'CHECK_IN' THEN
    IF v_record.id IS NOT NULL AND v_record.check_in_time IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_CHECKED_IN';
    END IF;

    -- Authoritative Campus Attendance Rule Lookup (NO SILENT FALLBACK)
    SELECT * INTO v_rule
    FROM public.campus_attendance_rules
    WHERE campus_id = v_campus.id
      AND active = TRUE
      AND (effective_from IS NULL OR effective_from <= v_today)
      AND (effective_to IS NULL OR effective_to >= v_today)
    ORDER BY effective_from DESC, version DESC
    LIMIT 1;

    IF v_rule.id IS NULL THEN
      INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
      VALUES (v_teacher_id, v_teacher_id, 'RULE_UNCONFIGURED', p_action_type, 
        'ATTENDANCE_RULE_NOT_CONFIGURED: No active attendance timing rule for ' || v_campus.campus_name || ' on ' || v_today);
      RAISE EXCEPTION 'ATTENDANCE_RULE_NOT_CONFIGURED: No active attendance timing rule configured for % on %. Please contact school administration.',
        v_campus.campus_name, v_today;
    END IF;

    -- Boundary comparison (<= late_threshold is PRESENT, > late_threshold is LATE)
    IF v_now_local_time <= v_rule.late_threshold THEN
      v_status := 'Present';
    ELSE
      v_status := 'Late';
    END IF;

    INSERT INTO public.teacher_attendance (
      teacher_id, attendance_date, status, check_in_time, 
      check_in_method, check_in_verification_status, 
      check_in_lat, check_in_lng, check_in_distance_meters,
      gps_accuracy, campus_id, kiosk_id,
      check_in_qr_session_id, recorded_at,
      attendance_rule_id, attendance_rule_version, applied_late_threshold
    )
    VALUES (
      v_teacher_id, v_today, v_status, v_now,
      'DYNAMIC_QR', 'VERIFIED',
      p_lat, p_lng, v_distance_meters,
      p_accuracy, v_campus.id, v_session.kiosk_id,
      v_session.id, v_now,
      v_rule.id, v_rule.version, v_rule.late_threshold
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
      recorded_at = v_now,
      attendance_rule_id = v_rule.id,
      attendance_rule_version = v_rule.version,
      applied_late_threshold = v_rule.late_threshold
    RETURNING id INTO v_record_id;

    v_rule_version := v_rule.version;
    v_late_threshold_str := v_rule.late_threshold::TEXT;
    v_check_in_time := v_now;
    v_check_out_time := NULL;

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
    v_record_id := v_record.id;
    v_check_in_time := v_record.check_in_time;
    v_check_out_time := v_now;
    v_rule_version := v_record.attendance_rule_version;
    v_late_threshold_str := v_record.applied_late_threshold::TEXT;
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
    'recordId', v_record_id,
    'campusId', v_campus.campus_id,
    'campusName', v_campus.campus_name,
    'checkInTime', v_check_in_time,
    'checkOutTime', v_check_out_time,
    'workingHours', v_working_hours_str,
    'distanceMeters', ROUND(v_distance_meters::NUMERIC, 1),
    'accuracyMeters', ROUND(COALESCE(p_accuracy, 0)::NUMERIC, 1),
    'serverTimestamp', v_now,
    'ruleVersion', v_rule_version,
    'lateThreshold', v_late_threshold_str
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_record_teacher_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;
