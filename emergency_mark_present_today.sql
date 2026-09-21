-- ==============================================================================
-- GYANODAY NIKETAN ERP: ONE-CLICK EMERGENCY ATTENDANCE OVERRIDE
-- Sets arrival time before 08:25 AM to ensure all teachers are marked PRESENT
-- Run this in Supabase Studio -> SQL Editor -> Click "Run"
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CREATE AUTHORITATIVE RPC FUNCTION FOR FUTURE ONE-CLICK BULK OVERRIDES
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_mark_present(
  p_campus_id UUID,
  p_attendance_date DATE DEFAULT CURRENT_DATE,
  p_check_in_time TIME DEFAULT '08:15:00'::TIME,
  p_teacher_ids UUID[] DEFAULT NULL,
  p_reason TEXT DEFAULT 'Administrative on-time bulk check-in override due to system outage'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_campus RECORD;
  v_rule RECORD;
  v_target_teachers UUID[];
  v_check_in_timestamptz TIMESTAMPTZ;
  v_updated_count INT := 0;
  v_target_id UUID;
BEGIN
  -- Verify caller privileges if authenticated session exists
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('admin', 'principal', 'coordinator') THEN
      RAISE EXCEPTION 'UNAUTHORIZED_ROLE: Only Administrators and Principals can perform bulk attendance overrides.';
    END IF;
  END IF;

  -- Validate campus
  SELECT * INTO v_campus FROM public.campuses WHERE id = p_campus_id;
  IF v_campus.id IS NULL THEN
    RAISE EXCEPTION 'CAMPUS_NOT_FOUND: Campus ID % does not exist.', p_campus_id;
  END IF;

  -- Resolve active rule for campus
  SELECT * INTO v_rule
  FROM public.campus_attendance_rules
  WHERE campus_id = v_campus.id
    AND active = TRUE
    AND (effective_from IS NULL OR effective_from <= p_attendance_date)
    AND (effective_to IS NULL OR effective_to >= p_attendance_date)
  ORDER BY version DESC
  LIMIT 1;

  -- Calculate IST (+05:30) check-in timestamp
  v_check_in_timestamptz := ((p_attendance_date || ' ' || p_check_in_time::TEXT)::TIMESTAMP AT TIME ZONE 'Asia/Kolkata');

  -- Determine target teachers
  IF p_teacher_ids IS NOT NULL AND array_length(p_teacher_ids, 1) > 0 THEN
    v_target_teachers := p_teacher_ids;
  ELSE
    SELECT array_agg(DISTINCT p.id) INTO v_target_teachers
    FROM public.profiles p
    WHERE p.role = 'teacher'
      AND p.status = 'Active'
      AND (
        p.campus = v_campus.campus_name
        OR p.campus = 'All Campuses'
        OR p.campus IS NULL
      );
  END IF;

  IF v_target_teachers IS NULL OR array_length(v_target_teachers, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'No active teachers found for campus ' || v_campus.campus_name,
      'count', 0
    );
  END IF;

  -- Upsert attendance record for each teacher
  FOREACH v_target_id IN ARRAY v_target_teachers
  LOOP
    INSERT INTO public.teacher_attendance (
      teacher_id,
      attendance_date,
      status,
      check_in_time,
      check_in_method,
      check_in_verification_status,
      campus_id,
      recorded_at,
      attendance_rule_id,
      attendance_rule_version,
      applied_late_threshold
    )
    VALUES (
      v_target_id,
      p_attendance_date,
      'Present',
      v_check_in_timestamptz,
      'ADMIN_OVERRIDE',
      'VERIFIED',
      v_campus.id,
      NOW(),
      v_rule.id,
      COALESCE(v_rule.version, 1),
      COALESCE(v_rule.late_threshold, '08:25:00'::TIME)
    )
    ON CONFLICT (teacher_id, attendance_date)
    DO UPDATE SET
      status = 'Present',
      check_in_time = v_check_in_timestamptz,
      check_in_method = 'ADMIN_OVERRIDE',
      check_in_verification_status = 'VERIFIED',
      campus_id = v_campus.id,
      attendance_rule_id = v_rule.id,
      attendance_rule_version = COALESCE(v_rule.version, 1),
      applied_late_threshold = COALESCE(v_rule.late_threshold, '08:25:00'::TIME),
      updated_at = NOW();

    -- Audit trail
    INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
    VALUES (
      v_target_id,
      auth.uid(),
      'ONE_CLICK_OVERRIDE',
      'Present',
      'One-Click Present at ' || v_campus.campus_name || ' (' || p_check_in_time::TEXT || '): ' || p_reason
    );

    v_updated_count := v_updated_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'campusName', v_campus.campus_name,
    'attendanceDate', p_attendance_date,
    'checkInTime', p_check_in_time::TEXT,
    'totalMarkedPresent', v_updated_count,
    'message', 'Successfully marked ' || v_updated_count || ' teachers present for ' || v_campus.campus_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_bulk_mark_present(UUID, DATE, TIME, UUID[], TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. ONE-CLICK EXECUTION FOR TODAY (SENIOR SCHOOL TEACHERS -> 08:15 AM PRESENT)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_senior_campus_id UUID;
  v_result JSONB;
BEGIN
  SELECT id INTO v_senior_campus_id FROM public.campuses WHERE campus_id = 'SENIOR_SCHOOL';
  
  IF v_senior_campus_id IS NOT NULL THEN
    v_result := public.admin_bulk_mark_present(
      p_campus_id := v_senior_campus_id,
      p_attendance_date := CURRENT_DATE,
      p_check_in_time := '08:15:00'::TIME,
      p_reason := 'Emergency on-time check-in override due to morning QR system disruption'
    );
    RAISE NOTICE 'Senior School Result: %', v_result;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. ONE-CLICK EXECUTION FOR TODAY (JUNIOR SCHOOL TEACHERS/STAFF -> 08:20 AM PRESENT)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_junior_campus_id UUID;
  v_junior_teacher_ids UUID[];
  v_result JSONB;
BEGIN
  SELECT id INTO v_junior_campus_id FROM public.campuses WHERE campus_id = 'JUNIOR_SCHOOL';
  
  -- Target Junior School staff or teachers associated with Junior School classes (Nursery to 5)
  SELECT array_agg(DISTINCT p.id) INTO v_junior_teacher_ids
  FROM public.profiles p
  WHERE p.status = 'Active'
    AND (
      p.campus = 'Junior School'
      OR EXISTS (
        SELECT 1 FROM public.teacher_subjects ts
        JOIN public.classes c ON c.id = ts.class_id
        WHERE ts.teacher_id = p.id AND c.name IN ('Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5')
      )
      OR EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.class_teacher_id = p.id AND c.name IN ('Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5')
      )
    );

  IF v_junior_campus_id IS NOT NULL AND v_junior_teacher_ids IS NOT NULL THEN
    v_result := public.admin_bulk_mark_present(
      p_campus_id := v_junior_campus_id,
      p_attendance_date := CURRENT_DATE,
      p_check_in_time := '08:20:00'::TIME,
      p_teacher_ids := v_junior_teacher_ids,
      p_reason := 'Emergency on-time check-in override for Junior School due to morning QR disruption'
    );
    RAISE NOTICE 'Junior School Result: %', v_result;
  END IF;
END $$;
