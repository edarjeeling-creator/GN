-- ==============================================================================
-- Attendance Analytics Suite
-- Version: 1.0.0
-- Environment: UAT / Production
-- Created: 2026-06-06
-- Author: Development Team
-- ==============================================================================
-- ROLLBACK: PRODUCTION READINESS PHASE
-- ==============================================================================

-- VERIFY BACKUP EXISTS BEFORE EXECUTION!
-- DO NOT RUN UNLESS A FRESH POINT-IN-TIME SNAPSHOT IS AVAILABLE.

-- [DRY RUN VALIDATION] Check tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('school_settings', 'attendance_overrides', 'parents', 'parent_student_map', 'school_calendar');

BEGIN;

DROP POLICY IF EXISTS "Allow all read on school_settings" ON public.school_settings;
DROP POLICY IF EXISTS "Allow all read on attendance_overrides" ON public.attendance_overrides;
DROP POLICY IF EXISTS "Allow all insert on attendance_overrides" ON public.attendance_overrides;
DROP POLICY IF EXISTS "Allow all read on parents" ON public.parents;
DROP POLICY IF EXISTS "Allow all read on parent_student_map" ON public.parent_student_map;
DROP POLICY IF EXISTS "Allow all read on school_calendar" ON public.school_calendar;

DROP TABLE IF EXISTS public.parent_student_map CASCADE;
DROP TABLE IF EXISTS public.parents CASCADE;
DROP TABLE IF EXISTS public.attendance_overrides CASCADE;
DROP TABLE IF EXISTS public.school_calendar CASCADE;
DROP TABLE IF EXISTS public.school_settings CASCADE;

COMMIT;

-- [POST-EXECUTION VALIDATION] Ensure tables are gone
-- SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('parents', 'school_settings');
