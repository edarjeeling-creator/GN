-- ==============================================================================
-- Attendance Analytics Suite
-- Version: 1.0.0
-- Environment: UAT / Production
-- Created: 2026-06-06
-- Author: Development Team
-- ==============================================================================
-- ROLLBACK: PHASE 1 (CORE ARCHITECTURE)
-- ==============================================================================

-- VERIFY BACKUP EXISTS BEFORE EXECUTION!
-- WARNING: This drops core tables including attendance, students, and teachers.

BEGIN;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.teacher_subjects CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

COMMIT;

-- [POST-EXECUTION VALIDATION] Ensure tables are gone
-- SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('profiles', 'attendance');
