-- rollback_user_management.sql
-- Executes the precise reversal of user_management_migration.sql

-- 1. Drop Policies
DROP POLICY IF EXISTS "Allow superadmin read audit logs" ON public.user_management_audit_logs;
DROP POLICY IF EXISTS "Allow superadmin insert audit logs" ON public.user_management_audit_logs;

DROP POLICY IF EXISTS "Allow superadmin read security_events" ON public.security_events;
DROP POLICY IF EXISTS "Allow superadmin insert security_events" ON public.security_events;

DROP POLICY IF EXISTS "Allow admin read parent_student_map" ON public.parent_student_map;
DROP POLICY IF EXISTS "Allow parents read own mapping" ON public.parent_student_map;
DROP POLICY IF EXISTS "Allow admin insert parent_student_map" ON public.parent_student_map;
DROP POLICY IF EXISTS "Allow admin update parent_student_map" ON public.parent_student_map;
DROP POLICY IF EXISTS "Allow admin delete parent_student_map" ON public.parent_student_map;

-- 2. Drop Tables
DROP TABLE IF EXISTS public.parent_student_map CASCADE;
DROP TABLE IF EXISTS public.security_events CASCADE;
DROP TABLE IF EXISTS public.user_management_audit_logs CASCADE;

-- 3. Revert public.profiles changes
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS last_login_at,
DROP COLUMN IF EXISTS employee_id,
DROP COLUMN IF EXISTS failed_login_attempts,
DROP COLUMN IF EXISTS locked_until;

-- Note: We do not revert the superadmin role changes back to 'admin' automatically
-- as this script is meant for schema rollback, not data rollback.
