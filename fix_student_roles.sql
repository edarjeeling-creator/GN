-- Run this in your Supabase SQL Editor to instantly fix all student roles
UPDATE public.profiles p
SET role = 'student'
WHERE role = 'teacher' 
AND EXISTS (
    SELECT 1 FROM public.students s 
    WHERE s.name ILIKE p.name
);
