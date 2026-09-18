-- Migration: Reduce Dynamic Attendance QR Rotation from 45 Seconds to 20 Seconds
-- Target RPCs: public.kiosk_generate_qr_session, public.generate_attendance_qr_session, school_settings

-- 1. Update school_settings
INSERT INTO public.school_settings (setting_key, setting_value, description)
VALUES ('attendance_qr_config', '{"expiry_seconds": 20}'::jsonb, 'Dynamic QR expiration window in seconds')
ON CONFLICT (setting_key) 
DO UPDATE SET setting_value = '{"expiry_seconds": 20}'::jsonb, updated_at = NOW();

-- 2. Update kiosk_generate_qr_session to use 20s default
CREATE OR REPLACE FUNCTION public.kiosk_generate_qr_session(
  p_device_id TEXT,
  p_kiosk_secret TEXT,
  p_action_type TEXT,
  p_expiry_seconds INT DEFAULT 20
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

  -- 5. Calculate clamped expiry (15s to 300s, default 20s)
  v_expiry_sec := COALESCE(p_expiry_seconds, 20);
  IF v_expiry_sec < 15 OR v_expiry_sec > 300 THEN
    v_expiry_sec := 20;
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
  SET last_heartbeat_at = NOW(),
      updated_at = NOW()
  WHERE id = v_kiosk.id;

  -- 9. Get live daily stats for this campus
  SELECT COUNT(DISTINCT teacher_id) INTO v_checked_in
  FROM public.teacher_attendance
  WHERE campus_id = v_campus.id AND date = v_today AND status IN ('PRESENT', 'LATE');

  SELECT COUNT(DISTINCT teacher_id) INTO v_checked_out
  FROM public.teacher_attendance
  WHERE campus_id = v_campus.id AND date = v_today AND check_out_time IS NOT NULL;

  -- 10. Return session payload
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
    'checkedOutCount', v_checked_out
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_generate_qr_session(TEXT, TEXT, TEXT, INT) TO anon, authenticated;

-- 3. Update generate_attendance_qr_session to use 20s default
CREATE OR REPLACE FUNCTION public.generate_attendance_qr_session(
  p_action_type TEXT,
  p_expiry_seconds INT DEFAULT 20,
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

  v_expiry_sec := COALESCE(p_expiry_seconds, 20);
  IF v_expiry_sec < 15 OR v_expiry_sec > 300 THEN
    v_expiry_sec := 20;
  END IF;

  -- Resolve Target Campus
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
