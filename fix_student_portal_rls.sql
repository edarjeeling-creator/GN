-- Run this script in your Supabase SQL Editor to completely unblock the Student Portal!

-- 1. Unblock Students table
DROP POLICY IF EXISTS "Allow authenticated read students" ON public.students;
DROP POLICY IF EXISTS "Allow teacher read students" ON public.students;
DROP POLICY IF EXISTS "Allow public read students" ON public.students;
CREATE POLICY "Allow public read students" ON public.students FOR SELECT USING (true);

-- 2. Unblock Feature Access table (in case it wasn't run earlier)
DROP POLICY IF EXISTS "Allow public read feature_access" ON public.feature_access;
DROP POLICY IF EXISTS "Allow authenticated read feature_access" ON public.feature_access;
CREATE POLICY "Allow public read feature_access" ON public.feature_access FOR SELECT USING (true);

-- 3. Unblock Classes table
DROP POLICY IF EXISTS "Allow public read classes" ON public.classes;
DROP POLICY IF EXISTS "Allow authenticated read classes" ON public.classes;
CREATE POLICY "Allow public read classes" ON public.classes FOR SELECT USING (true);

-- 4. Unblock Subjects table
DROP POLICY IF EXISTS "Allow public read subjects" ON public.subjects;
DROP POLICY IF EXISTS "Allow authenticated read subjects" ON public.subjects;
CREATE POLICY "Allow public read subjects" ON public.subjects FOR SELECT USING (true);
