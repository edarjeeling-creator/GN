-- ==============================================================================
-- GYANODAY NIKETAN ERP MIGRATION
-- Migration: 20260921_fix_group_d_and_support_staff_attendance.sql
-- Purpose:
-- 1. Updates admin_bulk_mark_present RPC to include all active faculty and support
--    staff roles (teacher, coordinator, non_teaching, group_d, staff, accountant, librarian).
-- 2. Makes bulk mark operation safe and non-destructive (WHERE check_in_time IS NULL).
-- 3. Marks administrative check-in truthfully as 'ADMIN_VERIFIED' and 'ADMIN_OVERRIDE'
--    (does not fabricate fake Dynamic QR / GPS verification).
-- 4. Idempotently repairs today's missing morning records for Group D & support staff.
-- ==============================================================================

-- 1. UPDATE RPC: admin_bulk_mark_present
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

  -- Determine target staff across all authoritative staff attendance roles
  IF p_teacher_ids IS NOT NULL AND array_length(p_teacher_ids, 1) > 0 THEN
    v_target_teachers := p_teacher_ids;
  ELSE
    SELECT array_agg(DISTINCT p.id) INTO v_target_teachers
    FROM public.profiles p
    WHERE p.role IN ('teacher', 'coordinator', 'non_teaching', 'group_d', 'staff', 'accountant', 'librarian')
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
      'message', 'No active staff found for campus ' || v_campus.campus_name,
      'count', 0
    );
  END IF;

  -- Upsert attendance record for each staff member (PRESERVING existing check-ins and check-outs)
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
      'ADMIN_VERIFIED', -- Truthful: NOT DYNAMIC_QR
      v_campus.id,
      NOW(),
      v_rule.id,
      COALESCE(v_rule.version, 1),
      COALESCE(v_rule.late_threshold, '08:25:00'::TIME)
    )
    ON CONFLICT (teacher_id, attendance_date)
    DO UPDATE SET
      status = CASE 
        WHEN teacher_attendance.status IS NULL OR teacher_attendance.status = 'Absent' THEN 'Present'
        ELSE teacher_attendance.status
      END,
      check_in_time = v_check_in_timestamptz,
      check_in_method = 'ADMIN_OVERRIDE',
      check_in_verification_status = 'ADMIN_VERIFIED',
      campus_id = COALESCE(teacher_attendance.campus_id, v_campus.id),
      attendance_rule_id = COALESCE(teacher_attendance.attendance_rule_id, v_rule.id),
      attendance_rule_version = COALESCE(teacher_attendance.attendance_rule_version, v_rule.version, 1),
      applied_late_threshold = COALESCE(teacher_attendance.applied_late_threshold, v_rule.late_threshold, '08:25:00'::TIME),
      updated_at = NOW()
    WHERE teacher_attendance.check_in_time IS NULL;

    IF FOUND THEN
      v_updated_count := v_updated_count + 1;

      -- Audit trail only when a record was actually created or updated
      INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
      VALUES (
        v_target_id,
        auth.uid(),
        'ONE_CLICK_OVERRIDE',
        'Present',
        'One-Click Present at ' || v_campus.campus_name || ' (' || p_check_in_time::TEXT || '): ' || p_reason
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'campusName', v_campus.campus_name,
    'attendanceDate', p_attendance_date,
    'checkInTime', p_check_in_time::TEXT,
    'totalMarkedPresent', v_updated_count,
    'message', 'Successfully processed attendance for ' || v_updated_count || ' staff members at ' || v_campus.campus_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_bulk_mark_present(UUID, DATE, TIME, UUID[], TEXT) TO authenticated;

-- 2. ONE-TIME IDEMPOTENT REPAIR FOR TODAY'S ACTIVE GROUP D & SUPPORT STAFF
DO $$
DECLARE
  v_target_date DATE := CURRENT_DATE;
  v_default_check_in_time TIME := '08:15:00'::TIME;
  v_check_in_timestamptz TIMESTAMPTZ;
  v_senior_campus_id UUID;
  v_junior_campus_id UUID;
  v_staff RECORD;
  v_existing RECORD;
  v_resolved_campus_id UUID;
  v_rule RECORD;
BEGIN
  v_check_in_timestamptz := ((v_target_date || ' ' || v_default_check_in_time::TEXT)::TIMESTAMP AT TIME ZONE 'Asia/Kolkata');

  SELECT id INTO v_senior_campus_id FROM public.campuses WHERE campus_id = 'SENIOR_SCHOOL' OR campus_name = 'Senior School' LIMIT 1;
  SELECT id INTO v_junior_campus_id FROM public.campuses WHERE campus_id = 'JUNIOR_SCHOOL' OR campus_name = 'Junior School' LIMIT 1;

  FOR v_staff IN
    SELECT p.id, p.name, p.role, p.campus, p.email
    FROM public.profiles p
    WHERE p.status = 'Active'
      AND p.role IN ('teacher', 'coordinator', 'non_teaching', 'group_d', 'staff', 'accountant', 'librarian')
  LOOP
    IF v_staff.campus = 'Junior School' THEN
      v_resolved_campus_id := v_junior_campus_id;
    ELSE
      v_resolved_campus_id := COALESCE(v_senior_campus_id, v_junior_campus_id);
    END IF;

    SELECT * INTO v_rule
    FROM public.campus_attendance_rules
    WHERE campus_id = v_resolved_campus_id
      AND active = TRUE
      AND (effective_from IS NULL OR effective_from <= v_target_date)
      AND (effective_to IS NULL OR effective_to >= v_target_date)
    ORDER BY version DESC
    LIMIT 1;

    SELECT * INTO v_existing
    FROM public.teacher_attendance
    WHERE teacher_id = v_staff.id AND attendance_date = v_target_date;

    IF v_existing.id IS NOT NULL THEN
      -- Record already exists with check_in_time -> PRESERVE completely
      IF v_existing.check_in_time IS NOT NULL THEN
        CONTINUE;
      END IF;

      -- Record exists but check_in_time is NULL -> populate check_in_time safely
      UPDATE public.teacher_attendance
      SET
        check_in_time = v_check_in_timestamptz,
        check_in_method = COALESCE(check_in_method, 'ADMIN_OVERRIDE'),
        check_in_verification_status = COALESCE(check_in_verification_status, 'ADMIN_VERIFIED'),
        campus_id = COALESCE(campus_id, v_resolved_campus_id),
        attendance_rule_id = COALESCE(attendance_rule_id, v_rule.id),
        attendance_rule_version = COALESCE(attendance_rule_version, v_rule.version, 1),
        applied_late_threshold = COALESCE(applied_late_threshold, v_rule.late_threshold, '08:25:00'::TIME),
        updated_at = NOW()
      WHERE id = v_existing.id;

      INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
      VALUES (
        v_staff.id,
        (SELECT id FROM public.profiles WHERE id = auth.uid()),
        COALESCE(v_existing.status, 'NOT_MARKED'),
        v_existing.status,
        'Emergency bulk attendance correction — populated missing check-in time for ' || v_staff.role || ' ' || v_staff.name
      );
    ELSE
      -- No attendance record today -> create ADMIN_VERIFIED arrival record
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
        v_staff.id,
        v_target_date,
        'Present',
        v_check_in_timestamptz,
        'ADMIN_OVERRIDE',
        'ADMIN_VERIFIED',
        v_resolved_campus_id,
        NOW(),
        v_rule.id,
        COALESCE(v_rule.version, 1),
        COALESCE(v_rule.late_threshold, '08:25:00'::TIME)
      );

      INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
      VALUES (
        v_staff.id,
        (SELECT id FROM public.profiles WHERE id = auth.uid()),
        'NOT_MARKED',
        'Present',
        'Emergency bulk attendance correction — morning attendance operation excluded Group D/support staff.'
      );
    END IF;
  END LOOP;
END $$;
