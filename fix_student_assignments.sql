-- Fix RLS Policies for Assignments Table (Unblock Students)
-- Because students use a custom login system and bypass Supabase Auth, 
-- they communicate with the database as "anonymous" users. 
-- We must allow public inserts and selects for this table.

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- 1. Unblock students to upload their own assignments
DROP POLICY IF EXISTS "Allow student insert assignments" ON public.assignments;
DROP POLICY IF EXISTS "Allow authenticated insert assignments" ON public.assignments;
CREATE POLICY "Allow student insert assignments" 
ON public.assignments 
FOR INSERT TO public 
WITH CHECK (true);

-- 2. Allow students to view assignments
DROP POLICY IF EXISTS "Allow read assignments" ON public.assignments;
DROP POLICY IF EXISTS "Allow authenticated read assignments" ON public.assignments;
CREATE POLICY "Allow read assignments" 
ON public.assignments 
FOR SELECT TO public 
USING (true);

-- 3. Allow teachers to update assignments (for grading/reviews)
DROP POLICY IF EXISTS "Allow teacher update assignments" ON public.assignments;
CREATE POLICY "Allow teacher update assignments" 
ON public.assignments 
FOR UPDATE TO public 
USING (true);
