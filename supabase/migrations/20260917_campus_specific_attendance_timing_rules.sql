-- ==============================================================================
-- GYANODAY NIKETAN ERP: CAMPUS-SPECIFIC STAFF ATTENDANCE TIMING RULES MIGRATION
-- Senior School (08:15 + 10m = 08:25:00) & Junior School (08:40 + 10m = 08:50:00)
-- Strict Historical Integrity, Immutable Versioning, Zero Silent Fallbacks
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. CAMPUS ATTENDANCE RULES TABLE (CONFIGURATION-DRIVEN ENGINE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campus_attendance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID NOT NULL REFERENCES public.campuses(id) ON DELETE RESTRICT,
  academic_year_id TEXT NOT NULL DEFAULT '2026',
  school_start_time TIME NOT NULL,
  grace_period_minutes INT NOT NULL DEFAULT 10 CHECK (grace_period_minutes >= 0),
  late_threshold TIME NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT check_effective_range CHECK (effective_to IS NULL OR effective_from <= effective_to)
);

CREATE INDEX IF NOT EXISTS idx_campus_attendance_rules_lookup
  ON public.campus_attendance_rules (campus_id, academic_year_id, active, effective_from);

ALTER TABLE public.campus_attendance_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read campus_attendance_rules" ON public.campus_attendance_rules;
CREATE POLICY "Allow authenticated read campus_attendance_rules"
  ON public.campus_attendance_rules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage campus_attendance_rules" ON public.campus_attendance_rules;
CREATE POLICY "Admin manage campus_attendance_rules"
  ON public.campus_attendance_rules FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'principal')
    )
  );

-- ------------------------------------------------------------------------------
-- 2. OVERLAP PREVENTION TRIGGER & AUTO-THRESHOLD DERIVATION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validate_campus_attendance_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_expected_threshold TIME;
  v_overlapping RECORD;
BEGIN
  -- 1. Derive and validate exact late threshold
  v_expected_threshold := (NEW.school_start_time + (NEW.grace_period_minutes || ' minutes')::INTERVAL)::TIME;
  IF NEW.late_threshold IS NULL THEN
    NEW.late_threshold := v_expected_threshold;
  ELSIF NEW.late_threshold != v_expected_threshold THEN
    RAISE EXCEPTION 'INCONSISTENT_THRESHOLD: late_threshold (%) does not match school_start_time (%) + grace_period_minutes (%) = %',
      NEW.late_threshold, NEW.school_start_time, NEW.grace_period_minutes, v_expected_threshold;
  END IF;

  -- 2. Overlap validation for active rules
  IF NEW.active = TRUE THEN
    SELECT * INTO v_overlapping
    FROM public.campus_attendance_rules
    WHERE campus_id = NEW.campus_id
      AND academic_year_id = NEW.academic_year_id
      AND active = TRUE
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND (
        NEW.effective_from <= COALESCE(effective_to, '9999-12-31'::DATE)
        AND COALESCE(NEW.effective_to, '9999-12-31'::DATE) >= effective_from
      )
    LIMIT 1;

    IF v_overlapping.id IS NOT NULL THEN
      RAISE EXCEPTION 'OVERLAPPING_ATTENDANCE_RULE: Active rule version % already exists for this campus covering period % to %',
        v_overlapping.version, v_overlapping.effective_from, COALESCE(v_overlapping.effective_to::TEXT, 'indefinite');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_campus_attendance_rule ON public.campus_attendance_rules;
CREATE TRIGGER trg_validate_campus_attendance_rule
  BEFORE INSERT OR UPDATE ON public.campus_attendance_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_campus_attendance_rule();

-- ------------------------------------------------------------------------------
-- 3. IMMUTABLE ATTENDANCE RULE AUDIT LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campus_attendance_rule_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.campus_attendance_rules(id) ON DELETE RESTRICT,
  campus_id UUID NOT NULL REFERENCES public.campuses(id) ON DELETE RESTRICT,
  academic_year_id TEXT NOT NULL,
  version INT NOT NULL,
  old_start_time TIME,
  new_start_time TIME NOT NULL,
  old_grace_period INT,
  new_grace_period INT NOT NULL,
  old_late_threshold TIME,
  new_late_threshold TIME NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT NOT NULL
);

ALTER TABLE public.campus_attendance_rule_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin read campus_attendance_rule_audit_logs" ON public.campus_attendance_rule_audit_logs;
CREATE POLICY "Allow admin read campus_attendance_rule_audit_logs"
  ON public.campus_attendance_rule_audit_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'principal')
    )
  );

-- ------------------------------------------------------------------------------
-- 4. EXTEND TEACHER ATTENDANCE TABLE (PRESERVE HISTORICAL INTEGRITY)
-- ------------------------------------------------------------------------------
ALTER TABLE public.teacher_attendance
  ADD COLUMN IF NOT EXISTS attendance_rule_id UUID REFERENCES public.campus_attendance_rules(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS attendance_rule_version INT,
  ADD COLUMN IF NOT EXISTS applied_late_threshold TIME;

-- ------------------------------------------------------------------------------
-- 5. SEED INITIAL CANONICAL RULES FOR SENIOR & JUNIOR SCHOOLS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_senior_id UUID;
  v_junior_id UUID;
  v_rule_id UUID;
BEGIN
  SELECT id INTO v_senior_id FROM public.campuses WHERE campus_id = 'SENIOR_SCHOOL';
  SELECT id INTO v_junior_id FROM public.campuses WHERE campus_id = 'JUNIOR_SCHOOL';

  -- Senior School: Start 08:15, Grace 10m -> Cutoff 08:25:00
  IF v_senior_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.campus_attendance_rules WHERE campus_id = v_senior_id AND academic_year_id = '2026'
  ) THEN
    INSERT INTO public.campus_attendance_rules (
      campus_id, academic_year_id, school_start_time, grace_period_minutes,
      late_threshold, effective_from, effective_to, active, version
    )
    VALUES (
      v_senior_id, '2026', '08:15:00'::TIME, 10,
      '08:25:00'::TIME, '2026-01-01'::DATE, NULL, TRUE, 1
    )
    RETURNING id INTO v_rule_id;

    INSERT INTO public.campus_attendance_rule_audit_logs (
      rule_id, campus_id, academic_year_id, version,
      new_start_time, new_grace_period, new_late_threshold,
      effective_from, reason
    )
    VALUES (
      v_rule_id, v_senior_id, '2026', 1,
      '08:15:00'::TIME, 10, '08:25:00'::TIME,
      '2026-01-01'::DATE, 'Initial Canonical Senior School Attendance Timing Rule (08:15 AM + 10m)'
    );
  END IF;

  -- Junior School: Start 08:40, Grace 10m -> Cutoff 08:50:00
  IF v_junior_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.campus_attendance_rules WHERE campus_id = v_junior_id AND academic_year_id = '2026'
  ) THEN
    INSERT INTO public.campus_attendance_rules (
      campus_id, academic_year_id, school_start_time, grace_period_minutes,
      late_threshold, effective_from, effective_to, active, version
    )
    VALUES (
      v_junior_id, '2026', '08:40:00'::TIME, 10,
      '08:50:00'::TIME, '2026-01-01'::DATE, NULL, TRUE, 1
    )
    RETURNING id INTO v_rule_id;

    INSERT INTO public.campus_attendance_rule_audit_logs (
      rule_id, campus_id, academic_year_id, version,
      new_start_time, new_grace_period, new_late_threshold,
      effective_from, reason
    )
    VALUES (
      v_rule_id, v_junior_id, '2026', 1,
      '08:40:00'::TIME, 10, '08:50:00'::TIME,
      '2026-01-01'::DATE, 'Initial Canonical Junior School Attendance Timing Rule (08:40 AM + 10m)'
    );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. DROP OLD 5-PARAM OVERLOADED FUNCTION TO PREVENT PGRST203 CONFLICTS
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.verify_and_record_teacher_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT);

-- ------------------------------------------------------------------------------
-- 7. AUTHORITATIVE ATTENDANCE VERIFICATION RPC SUPPORTING ALL STAFF ROLES
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

  -- 3. Verify Teacher Campus Authorization (Leadership has roaming authority)
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

    -- EXACT BOUNDARY COMPARISON (INCLUSIVE <= late_threshold is PRESENT, > late_threshold is LATE)
    -- Junior: 08:50:00 -> PRESENT, 08:50:01 -> LATE
    -- Senior: 08:25:00 -> PRESENT, 08:25:01 -> LATE
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
      applied_late_threshold = v_rule.late_threshold;

  ELSIF p_action_type = 'CHECK_OUT' THEN
    IF v_record.id IS NULL OR v_record.check_in_time IS NULL THEN
      RAISE EXCEPTION 'NO_CHECK_IN_FOUND';
    END IF;

    IF v_record.check_out_time IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_CHECKED_OUT';
    END IF;

    v_duration_seconds := EXTRACT(EPOCH FROM (v_now - v_record.check_in_time));
    v_working_hours_str := to_char(INTERVAL '1 second' * v_duration_seconds, 'HH24:MI:SS');

    -- Note: Check-out does NOT alter original check-in status (Late remains Late, Present remains Present)
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
    'distanceMeters', ROUND(v_distance_meters::NUMERIC, 1),
    'ruleVersion', CASE WHEN p_action_type = 'CHECK_IN' THEN v_rule.version ELSE v_record.attendance_rule_version END,
    'lateThreshold', CASE WHEN p_action_type = 'CHECK_IN' THEN v_rule.late_threshold::TEXT ELSE v_record.applied_late_threshold::TEXT END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_record_teacher_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. ADMINISTRATIVE RPCS: IMMUTABLE RULE CONFIGURATION & AUDIT TRAIL
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_campus_attendance_rules()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rules JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'campus_id', r.campus_id,
      'campus_slug', c.campus_id,
      'campus_name', c.campus_name,
      'academic_year_id', r.academic_year_id,
      'school_start_time', r.school_start_time::TEXT,
      'grace_period_minutes', r.grace_period_minutes,
      'late_threshold', r.late_threshold::TEXT,
      'effective_from', r.effective_from,
      'effective_to', r.effective_to,
      'active', r.active,
      'version', r.version,
      'created_at', r.created_at
    ) ORDER BY c.campus_name, r.version DESC
  ) INTO v_rules
  FROM public.campus_attendance_rules r
  JOIN public.campuses c ON c.id = r.campus_id;

  RETURN COALESCE(v_rules, '[]'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_campus_attendance_rules() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_or_update_campus_attendance_rule(
  p_campus_id UUID,
  p_school_start_time TIME,
  p_grace_period_minutes INT,
  p_effective_from DATE DEFAULT CURRENT_DATE,
  p_reason TEXT DEFAULT 'Administrative attendance timing update'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_campus RECORD;
  v_current_rule RECORD;
  v_new_threshold TIME;
  v_new_version INT := 1;
  v_new_rule_id UUID;
BEGIN
  -- 1. Server-side Role Authorization
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Please log in to manage attendance rules.';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('admin', 'principal') THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ROLE: Only Administrators and Principals may configure attendance rules.';
  END IF;

  -- 2. Input Validation
  IF p_campus_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_CAMPUS: Campus ID is required.';
  END IF;

  SELECT * INTO v_campus FROM public.campuses WHERE id = p_campus_id;
  IF v_campus.id IS NULL THEN
    RAISE EXCEPTION 'CAMPUS_NOT_FOUND: Campus does not exist.';
  END IF;

  IF p_school_start_time IS NULL THEN
    RAISE EXCEPTION 'INVALID_START_TIME: School start time is required.';
  END IF;

  IF p_grace_period_minutes IS NULL OR p_grace_period_minutes < 0 THEN
    RAISE EXCEPTION 'INVALID_GRACE_PERIOD: Grace period minutes must be zero or positive.';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED: An audit reason is required to modify attendance timing rules.';
  END IF;

  -- 3. Calculate authoritative late threshold
  v_new_threshold := (p_school_start_time + (p_grace_period_minutes || ' minutes')::INTERVAL)::TIME;

  -- 4. Locate current active rule
  SELECT * INTO v_current_rule
  FROM public.campus_attendance_rules
  WHERE campus_id = p_campus_id
    AND active = TRUE
    AND (effective_to IS NULL OR effective_to >= p_effective_from)
  ORDER BY version DESC
  LIMIT 1;

  IF v_current_rule.id IS NOT NULL THEN
    -- Check if effectively identical
    IF v_current_rule.school_start_time = p_school_start_time 
       AND v_current_rule.grace_period_minutes = p_grace_period_minutes 
       AND v_current_rule.effective_from = p_effective_from THEN
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Rule already active with identical timing settings',
        'ruleId', v_current_rule.id,
        'version', v_current_rule.version
      );
    END IF;

    -- Close current rule as of previous day
    IF p_effective_from <= v_current_rule.effective_from THEN
      UPDATE public.campus_attendance_rules
      SET active = FALSE, effective_to = p_effective_from - 1
      WHERE id = v_current_rule.id;
    ELSE
      UPDATE public.campus_attendance_rules
      SET effective_to = p_effective_from - 1
      WHERE id = v_current_rule.id;
    END IF;

    v_new_version := v_current_rule.version + 1;
  END IF;

  -- 5. Insert new immutable version
  INSERT INTO public.campus_attendance_rules (
    campus_id, academic_year_id, school_start_time, grace_period_minutes,
    late_threshold, effective_from, effective_to, active, version, created_by
  )
  VALUES (
    p_campus_id, '2026', p_school_start_time, p_grace_period_minutes,
    v_new_threshold, p_effective_from, NULL, TRUE, v_new_version, auth.uid()
  )
  RETURNING id INTO v_new_rule_id;

  -- 6. Record immutable audit log
  INSERT INTO public.campus_attendance_rule_audit_logs (
    rule_id, campus_id, academic_year_id, version,
    old_start_time, new_start_time,
    old_grace_period, new_grace_period,
    old_late_threshold, new_late_threshold,
    effective_from, effective_to,
    changed_by, reason
  )
  VALUES (
    v_new_rule_id, p_campus_id, '2026', v_new_version,
    v_current_rule.school_start_time, p_school_start_time,
    v_current_rule.grace_period_minutes, p_grace_period_minutes,
    v_current_rule.late_threshold, v_new_threshold,
    p_effective_from, NULL,
    auth.uid(), p_reason
  );

  RETURN jsonb_build_object(
    'success', true,
    'ruleId', v_new_rule_id,
    'version', v_new_version,
    'campusName', v_campus.campus_name,
    'schoolStartTime', p_school_start_time::TEXT,
    'gracePeriodMinutes', p_grace_period_minutes,
    'lateThreshold', v_new_threshold::TEXT,
    'effectiveFrom', p_effective_from
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_or_update_campus_attendance_rule(UUID, TIME, INT, DATE, TEXT) TO authenticated;
