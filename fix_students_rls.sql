-- Run this in your Supabase SQL Editor to allow students to read their own records
DROP POLICY IF EXISTS "Allow authenticated read students" ON public.students;
DROP POLICY IF EXISTS "Allow teacher read students" ON public.students;
DROP POLICY IF EXISTS "Allow public read students" ON public.students;

-- Create a policy allowing all authenticated users (including students) to read the students table
CREATE POLICY "Allow authenticated read students" 
ON public.students 
FOR SELECT 
TO authenticated 
USING (true);
