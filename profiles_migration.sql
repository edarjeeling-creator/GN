-- Run this in your Supabase SQL Editor to add the missing columns to the profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS picture_url TEXT,
  ADD COLUMN IF NOT EXISTS designation TEXT,
  ADD COLUMN IF NOT EXISTS dob TEXT,
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS contact_number TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS employee_id TEXT;

-- Notify Supabase to reload the schema cache so the API immediately recognizes the new columns
NOTIFY pgrst, 'reload schema';
