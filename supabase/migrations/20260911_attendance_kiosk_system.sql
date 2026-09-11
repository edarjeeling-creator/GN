-- ====================================================================
-- ATTENDANCE TABLET / KIOSK SYSTEM MIGRATION
-- Dedicated, Scoped, Zero-Admin Tablet Authorization & QR Generation
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. KIOSKS TABLE
CREATE TABLE IF NOT EXISTS public.attendance_kiosks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  device_name TEXT NOT NULL,
  location_name TEXT NOT NULL,
  kiosk_secret_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'INACTIVE')),
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.attendance_kiosks ENABLE ROW LEVEL SECURITY;

-- Allow only administrators (admin, principal) to view or manage kiosks directly
DROP POLICY IF EXISTS "Admin manage attendance_kiosks" ON public.attendance_kiosks;
CREATE POLICY "Admin manage attendance_kiosks"
  ON public.attendance_kiosks FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'principal')
    )
  );

-- 2. SEED DEFAULT KIOSK: GN-KIOSK-001 (Main Entrance)
-- Pairing Secret: GyanodayKiosk@2026
-- SHA-256 hash: encode(digest('GyanodayKiosk@2026', 'sha256'), 'hex')
INSERT INTO public.attendance_kiosks (
  device_id, device_name, location_name, kiosk_secret_hash, status
)
VALUES (
  'GN-KIOSK-001',
  'Main Entrance Kiosk Tablet',
  'Main Campus Entrance',
  encode(digest('GyanodayKiosk@2026', 'sha256'), 'hex'),
  'ACTIVE'
)
ON CONFLICT (device_id) DO NOTHING;

-- 3. KIOSK RPC: GENERATE DYNAMIC QR SESSION
-- Strictly scoped to valid active kiosks. Does NOT require any admin/teacher login.
CREATE OR REPLACE FUNCTION public.kiosk_generate_qr_session(
  p_device_id TEXT,
  p_kiosk_secret TEXT,
  p_action_type TEXT,
  p_expiry_seconds INT DEFAULT 45
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kiosk RECORD;
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
  v_secret_hash := encode(digest(p_kiosk_secret, 'sha256'), 'hex');
  IF v_secret_hash != v_kiosk.kiosk_secret_hash THEN
    RAISE EXCEPTION 'UNAUTHORIZED_KIOSK: Invalid credentials';
  END IF;

  -- 3. Validate action type
  IF p_action_type NOT IN ('CHECK_IN', 'CHECK_OUT') THEN
    RAISE EXCEPTION 'INVALID_ACTION_TYPE: Must be CHECK_IN or CHECK_OUT';
  END IF;

  -- 4. Calculate clamped expiry (15s to 300s, default 45s)
  v_expiry_sec := COALESCE(p_expiry_seconds, 45);
  IF v_expiry_sec < 15 OR v_expiry_sec > 300 THEN
    v_expiry_sec := 45;
  END IF;

  -- 5. Deactivate previous active sessions for same action type
  UPDATE public.attendance_qr_sessions
  SET is_active = FALSE
  WHERE action_type = p_action_type AND is_active = TRUE;

  -- 6. Generate secure session token
  v_token := 'GNQR_' || p_action_type || '_' || md5(gen_random_uuid()::TEXT || clock_timestamp()::TEXT);
  v_expires_at := NOW() + (v_expiry_sec || ' seconds')::INTERVAL;

  INSERT INTO public.attendance_qr_sessions (
    session_token, action_type, created_by, expires_at, is_active, created_at
  )
  VALUES (
    v_token, p_action_type, NULL, v_expires_at, TRUE, NOW()
  )
  RETURNING id INTO v_session_id;

  -- 7. Update kiosk heartbeat
  UPDATE public.attendance_kiosks
  SET last_heartbeat = NOW()
  WHERE id = v_kiosk.id;

  -- 8. Fetch today's anonymous counters (aggregated count only, NO teacher names or PII)
  SELECT 
    COUNT(CASE WHEN check_in_time IS NOT NULL THEN 1 END),
    COUNT(CASE WHEN check_out_time IS NOT NULL THEN 1 END)
  INTO v_checked_in, v_checked_out
  FROM public.teacher_attendance
  WHERE attendance_date = v_today;

  RETURN jsonb_build_object(
    'sessionId', v_session_id,
    'sessionToken', v_token,
    'actionType', p_action_type,
    'expiresAt', v_expires_at,
    'serverTime', NOW(),
    'deviceId', v_kiosk.device_id,
    'locationName', v_kiosk.location_name,
    'checkedInCount', v_checked_in,
    'checkedOutCount', v_checked_out,
    'payloadString', json_build_object(
      'prefix', 'GN-ATT',
      'token', v_token,
      'action', p_action_type,
      'kiosk', v_kiosk.device_id,
      'created_at', NOW(),
      'expires_at', v_expires_at
    )::TEXT
  );
END;
$$;

-- Grant EXECUTE permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.kiosk_generate_qr_session(TEXT, TEXT, TEXT, INT) TO anon, authenticated;

-- 4. ADMIN RPC: MANAGE KIOSKS (CREATE, LIST, REVOKE, DELETE)
-- Strictly restricted to Admin and Principal roles
CREATE OR REPLACE FUNCTION public.admin_manage_kiosks(
  p_action TEXT,
  p_device_id TEXT DEFAULT NULL,
  p_device_name TEXT DEFAULT NULL,
  p_location_name TEXT DEFAULT NULL,
  p_secret_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_hash TEXT;
  v_result JSONB;
BEGIN
  -- Authenticate caller
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
        'device_id', device_id,
        'device_name', device_name,
        'location_name', location_name,
        'status', status,
        'last_heartbeat', last_heartbeat,
        'created_at', created_at
      ) ORDER BY created_at DESC), '[]'::JSON) INTO v_result
      FROM public.attendance_kiosks;
      RETURN jsonb_build_object('success', true, 'kiosks', v_result);

    WHEN 'REGISTER' THEN
      IF p_device_id IS NULL OR p_secret_key IS NULL THEN
        RAISE EXCEPTION 'INVALID_PARAMETERS: device_id and secret_key required';
      END IF;

      v_hash := encode(digest(p_secret_key, 'sha256'), 'hex');

      INSERT INTO public.attendance_kiosks (
        device_id, device_name, location_name, kiosk_secret_hash, status, created_by
      )
      VALUES (
        p_device_id,
        COALESCE(p_device_name, 'Kiosk ' || p_device_id),
        COALESCE(p_location_name, 'School Campus'),
        v_hash,
        'ACTIVE',
        auth.uid()
      )
      ON CONFLICT (device_id) DO UPDATE SET
        device_name = EXCLUDED.device_name,
        location_name = EXCLUDED.location_name,
        kiosk_secret_hash = EXCLUDED.kiosk_secret_hash,
        status = 'ACTIVE';

      RETURN jsonb_build_object('success', true, 'device_id', p_device_id, 'status', 'ACTIVE');

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

GRANT EXECUTE ON FUNCTION public.admin_manage_kiosks(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Notify schema reload for PostgREST
NOTIFY pgrst, 'reload schema';
