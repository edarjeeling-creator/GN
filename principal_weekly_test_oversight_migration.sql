-- principal_weekly_test_oversight_migration.sql
-- Enables Principal, Admin, Superadmin, and Coordinator oversight and management of weekly tests and marks.

-- 1. Ensure RLS on weekly_tests
ALTER TABLE IF EXISTS public.weekly_tests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all weekly tests
DROP POLICY IF EXISTS "Allow authenticated read weekly_tests" ON public.weekly_tests;
CREATE POLICY "Allow authenticated read weekly_tests" ON public.weekly_tests 
FOR SELECT TO authenticated 
USING (true);

-- Allow teachers to insert their own weekly tests, and Principal/Admin to create weekly tests
DROP POLICY IF EXISTS "Allow teacher insert weekly_tests" ON public.weekly_tests;
DROP POLICY IF EXISTS "Allow authorized insert weekly_tests" ON public.weekly_tests;
CREATE POLICY "Allow authorized insert weekly_tests" ON public.weekly_tests 
FOR INSERT TO authenticated 
WITH CHECK (
    teacher_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role IN ('admin', 'superadmin', 'principal', 'coordinator') OR designation ILIKE '%principal%' OR designation ILIKE '%coordinator%')
    )
);

-- Allow teachers to update their own tests if Draft; Principal/Admin can update status (Approve) and fields
DROP POLICY IF EXISTS "Allow teacher update draft weekly_tests" ON public.weekly_tests;
DROP POLICY IF EXISTS "Allow authorized update weekly_tests" ON public.weekly_tests;
CREATE POLICY "Allow authorized update weekly_tests" ON public.weekly_tests 
FOR UPDATE TO authenticated 
USING (
    (teacher_id = auth.uid() AND status = 'Draft') OR 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role IN ('admin', 'superadmin', 'principal', 'coordinator') OR designation ILIKE '%principal%' OR designation ILIKE '%coordinator%')
    )
);

-- Allow delete of tests: teachers if Draft, Admin/Principal anytime
DROP POLICY IF EXISTS "Allow teacher delete draft weekly_tests" ON public.weekly_tests;
DROP POLICY IF EXISTS "Allow authorized delete weekly_tests" ON public.weekly_tests;
CREATE POLICY "Allow authorized delete weekly_tests" ON public.weekly_tests 
FOR DELETE TO authenticated 
USING (
    (teacher_id = auth.uid() AND status = 'Draft') OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'superadmin', 'principal')
    )
);

-- 2. Ensure RLS on weekly_test_marks
ALTER TABLE IF EXISTS public.weekly_test_marks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read weekly test marks
DROP POLICY IF EXISTS "Allow authenticated read weekly_test_marks" ON public.weekly_test_marks;
CREATE POLICY "Allow authenticated read weekly_test_marks" ON public.weekly_test_marks 
FOR SELECT TO authenticated 
USING (true);

-- Allow teachers to insert marks for their tests if Draft; Principal/Admin can insert too
DROP POLICY IF EXISTS "Allow teacher insert weekly_test_marks" ON public.weekly_test_marks;
DROP POLICY IF EXISTS "Allow authorized insert weekly_test_marks" ON public.weekly_test_marks;
CREATE POLICY "Allow authorized insert weekly_test_marks" ON public.weekly_test_marks 
FOR INSERT TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.weekly_tests 
        WHERE id = test_id AND teacher_id = auth.uid() AND status = 'Draft'
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role IN ('admin', 'superadmin', 'principal') OR designation ILIKE '%principal%')
    )
);

-- Allow teachers to update marks for their tests if Draft; Principal/Admin can correct marks too
DROP POLICY IF EXISTS "Allow teacher update weekly_test_marks" ON public.weekly_test_marks;
DROP POLICY IF EXISTS "Allow authorized update weekly_test_marks" ON public.weekly_test_marks;
CREATE POLICY "Allow authorized update weekly_test_marks" ON public.weekly_test_marks 
FOR UPDATE TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.weekly_tests 
        WHERE id = test_id AND teacher_id = auth.uid() AND status = 'Draft'
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role IN ('admin', 'superadmin', 'principal') OR designation ILIKE '%principal%')
    )
);

-- Allow teachers to delete marks if Draft; Principal/Admin can delete if needed
DROP POLICY IF EXISTS "Allow teacher delete weekly_test_marks" ON public.weekly_test_marks;
DROP POLICY IF EXISTS "Allow authorized delete weekly_test_marks" ON public.weekly_test_marks;
CREATE POLICY "Allow authorized delete weekly_test_marks" ON public.weekly_test_marks 
FOR DELETE TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.weekly_tests 
        WHERE id = test_id AND teacher_id = auth.uid() AND status = 'Draft'
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role IN ('admin', 'superadmin', 'principal') OR designation ILIKE '%principal%')
    )
);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

