-- Fix RLS Policies for Assignments Table
-- This script unblocks the student upload and teacher review flows.

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- 1. Unblock students to upload their own assignments
DROP POLICY IF EXISTS "Allow student insert assignments" ON public.assignments;
DROP POLICY IF EXISTS "Allow authenticated insert assignments" ON public.assignments;
CREATE POLICY "Allow student insert assignments" 
ON public.assignments 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid()::text = student_uid::text);

-- 2. Allow students to view their own, and teachers to view all assignments
DROP POLICY IF EXISTS "Allow read assignments" ON public.assignments;
DROP POLICY IF EXISTS "Allow authenticated read assignments" ON public.assignments;
CREATE POLICY "Allow read assignments" 
ON public.assignments 
FOR SELECT TO authenticated 
USING (
  auth.uid()::text = student_uid::text OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin', 'principal'))
);

-- 3. Allow teachers to update assignments (for grading/reviews)
DROP POLICY IF EXISTS "Allow teacher update assignments" ON public.assignments;
CREATE POLICY "Allow teacher update assignments" 
ON public.assignments 
FOR UPDATE TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin', 'principal'))
);
