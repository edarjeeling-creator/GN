-- ==============================================================================
-- Attendance Analytics Suite
-- Version: 1.0.0
-- Environment: UAT / Production
-- Created: 2026-06-06
-- Author: Development Team
-- ==============================================================================
-- ROLLBACK: PHASE 2 (ALERTS & NOTIFICATIONS)
-- ==============================================================================

-- VERIFY BACKUP EXISTS BEFORE EXECUTION!

BEGIN;

-- Drop Triggers
DROP TRIGGER IF EXISTS trigger_attendance_notification ON public.attendance;
DROP TRIGGER IF EXISTS trigger_attendance_alerts ON public.attendance;

-- Drop Functions
DROP FUNCTION IF EXISTS public.handle_attendance_notification();
DROP FUNCTION IF EXISTS public.handle_attendance_alerts();

-- Drop Tables
DROP TABLE IF EXISTS public.student_notifications CASCADE;
DROP TABLE IF EXISTS public.system_alerts CASCADE;

COMMIT;

-- [POST-EXECUTION VALIDATION] Ensure tables are gone
-- SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('student_notifications', 'system_alerts');
