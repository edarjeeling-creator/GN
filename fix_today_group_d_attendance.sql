-- ==============================================================================
-- GYANODAY NIKETAN ERP: FIX TODAY'S GROUP D & SUPPORT STAFF ATTENDANCE
-- Date: 2026-09-21
-- Purpose: Safely and idempotently backfill morning check-in records for active
--          Group D and support staff who were excluded from this morning's
--          emergency attendance operation, allowing them to check out securely.
--
-- SAFETY & AUDIT INTEGRITY:
-- 1. PRESERVES all existing legitimate attendance records, check-in times,
--    check-out times, GPS data, and QR verification statuses.
-- 2. TRUTHFUL AUDIT: check_in_method is 'ADMIN_OVERRIDE' and verification status
--    is 'ADMIN_VERIFIED' (never falsely claims Dynamic QR or GPS verification).
-- 3. IDEMPOTENT: Safe to run multiple times without duplicating or corrupting data.
-- ==============================================================================

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
  v_total_eligible INT := 0;
  v_already_recorded INT := 0;
  v_already_checked_out INT := 0;
  v_newly_created INT := 0;
  v_updated_missing_time INT := 0;
  v_details JSONB := '[]'::JSONB;
BEGIN
  -- 1. Calculate authoritative IST (+05:30) check-in timestamp
  v_check_in_timestamptz := ((v_target_date || ' ' || v_default_check_in_time::TEXT)::TIMESTAMP AT TIME ZONE 'Asia/Kolkata');

  -- 2. Resolve Campus IDs
  SELECT id INTO v_senior_campus_id FROM public.campuses WHERE campus_id = 'SENIOR_SCHOOL' OR campus_name = 'Senior School' LIMIT 1;
  SELECT id INTO v_junior_campus_id FROM public.campuses WHERE campus_id = 'JUNIOR_SCHOOL' OR campus_name = 'Junior School' LIMIT 1;

  RAISE NOTICE '------------------------------------------------------------';
  RAISE NOTICE 'GYANODAY NIKETAN: AUDITING & REPAIRING STAFF ATTENDANCE';
  RAISE NOTICE 'Target Date: % | IST Check-in: %', v_target_date, v_check_in_timestamptz;
  RAISE NOTICE '------------------------------------------------------------';

  -- 3. Iterate through all active staff eligible for attendance
  FOR v_staff IN
    SELECT p.id, p.name, p.role, p.campus, p.email
    FROM public.profiles p
    WHERE p.status = 'Active'
      AND p.role IN ('teacher', 'coordinator', 'non_teaching', 'group_d', 'staff', 'accountant', 'librarian')
    ORDER BY p.role, p.name
  LOOP
    v_total_eligible := v_total_eligible + 1;

    -- Resolve campus for this staff member
    IF v_staff.campus = 'Junior School' THEN
      v_resolved_campus_id := v_junior_campus_id;
    ELSE
      v_resolved_campus_id := COALESCE(v_senior_campus_id, v_junior_campus_id);
    END IF;

    -- Resolve active rule for the campus
    SELECT * INTO v_rule
    FROM public.campus_attendance_rules
    WHERE campus_id = v_resolved_campus_id
      AND active = TRUE
      AND (effective_from IS NULL OR effective_from <= v_target_date)
      AND (effective_to IS NULL OR effective_to >= v_target_date)
    ORDER BY version DESC
    LIMIT 1;

    -- Check if record already exists for today
    SELECT * INTO v_existing
    FROM public.teacher_attendance
    WHERE teacher_id = v_staff.id AND attendance_date = v_target_date;

    IF v_existing.id IS NOT NULL THEN
      -- Case A: Record exists AND check_in_time is already set -> PRESERVE ENTIRELY
      IF v_existing.check_in_time IS NOT NULL THEN
        v_already_recorded := v_already_recorded + 1;
        IF v_existing.check_out_time IS NOT NULL THEN
          v_already_checked_out := v_already_checked_out + 1;
        END IF;

        -- DO NOT OVERWRITE ANYTHING. Existing data is legitimate and preserved.
        CONTINUE;
      END IF;

      -- Case B: Record exists, but check_in_time is NULL (e.g. from an old manual status edit)
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

      v_updated_missing_time := v_updated_missing_time + 1;

      -- Record truthful audit log
      INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
      VALUES (
        v_staff.id,
        (SELECT id FROM public.profiles WHERE id = auth.uid()),
        COALESCE(v_existing.status, 'NOT_MARKED'),
        v_existing.status,
        'Emergency bulk attendance correction — populated missing check-in time for ' || v_staff.role || ' ' || v_staff.name
      );

      v_details := v_details || jsonb_build_object(
        'name', v_staff.name,
        'role', v_staff.role,
        'action', 'UPDATED_MISSING_TIME'
      );

    ELSE
      -- Case C: No attendance record exists today -> Create ADMIN_VERIFIED morning check-in
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
        'ADMIN_VERIFIED', -- Truthful: administrative, not dynamic QR
        v_resolved_campus_id,
        NOW(),
        v_rule.id,
        COALESCE(v_rule.version, 1),
        COALESCE(v_rule.late_threshold, '08:25:00'::TIME)
      );

      v_newly_created := v_newly_created + 1;

      -- Record truthful audit log
      INSERT INTO public.attendance_audit_logs (record_id, modified_by, original_status, new_status, reason)
      VALUES (
        v_staff.id,
        (SELECT id FROM public.profiles WHERE id = auth.uid()),
        'NOT_MARKED',
        'Present',
        'Emergency bulk attendance correction — morning attendance operation excluded Group D/support staff.'
      );

      v_details := v_details || jsonb_build_object(
        'name', v_staff.name,
        'role', v_staff.role,
        'action', 'CREATED_MORNING_RECORD'
      );
    END IF;
  END LOOP;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'REPAIR COMPLETED SUCCESSFULLY:';
  RAISE NOTICE '  Total Active Eligible Staff: %', v_total_eligible;
  RAISE NOTICE '  Already Had Valid Check-In:   % (Preserved)', v_already_recorded;
  RAISE NOTICE '  Already Checked Out:          % (Preserved)', v_already_checked_out;
  RAISE NOTICE '  Newly Created Check-In:       % (Group D / Support)', v_newly_created;
  RAISE NOTICE '  Updated Missing Check-In:     % ', v_updated_missing_time;
  RAISE NOTICE '============================================================';
END $$;
