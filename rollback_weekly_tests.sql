-- rollback_weekly_tests.sql
-- WARNING: Executing this script will permanently delete ALL weekly test data!
-- Only run this if you need to completely revert the Digital Weekly Test module installation.

-- 1. Drop RLS Policies
DROP POLICY IF EXISTS "Allow authenticated read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow admin update app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow admin insert app_settings" ON public.app_settings;

DROP POLICY IF EXISTS "Allow authenticated read weekly_tests" ON public.weekly_tests;
DROP POLICY IF EXISTS "Allow teacher insert weekly_tests" ON public.weekly_tests;
DROP POLICY IF EXISTS "Allow teacher update draft weekly_tests" ON public.weekly_tests;
DROP POLICY IF EXISTS "Allow teacher delete draft weekly_tests" ON public.weekly_tests;

DROP POLICY IF EXISTS "Allow authenticated read weekly_test_marks" ON public.weekly_test_marks;
DROP POLICY IF EXISTS "Allow teacher insert weekly_test_marks" ON public.weekly_test_marks;
DROP POLICY IF EXISTS "Allow teacher update weekly_test_marks" ON public.weekly_test_marks;
DROP POLICY IF EXISTS "Allow teacher delete weekly_test_marks" ON public.weekly_test_marks;

-- 2. Drop Tables
DROP TABLE IF EXISTS public.weekly_test_marks CASCADE;
DROP TABLE IF EXISTS public.weekly_tests CASCADE;

-- Note: We are NOT dropping public.app_settings entirely here because it may be used by future modules.
-- However, we will remove the weekly test specific setting.
DELETE FROM public.app_settings WHERE key = 'weekly_test_pass_percentage';
