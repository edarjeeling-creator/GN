-- Run this script in your Supabase SQL Editor to allow Zero-Auth students to see Python Patshala
-- Drop the existing policy
DROP POLICY IF EXISTS "Allow authenticated read feature_access" ON public.feature_access;

-- Create a new policy that allows everyone (including anon / Zero-Auth students) to read feature access
CREATE POLICY "Allow public read feature_access" 
ON public.feature_access 
FOR SELECT 
USING (true);
