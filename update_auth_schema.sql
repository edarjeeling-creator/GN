-- Run this in your Supabase SQL Editor to enable Name/UID login

-- 1. Add UID to teachers (profiles)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS uid TEXT UNIQUE;

-- Generate random UIDs for existing teachers who don't have one
UPDATE public.profiles 
SET uid = 'TCH' || floor(random() * 9000 + 1000)::text 
WHERE uid IS NULL AND role = 'teacher';

-- Generate a UID for existing admins who don't have one
UPDATE public.profiles 
SET uid = 'ADM' || floor(random() * 9000 + 1000)::text 
WHERE uid IS NULL AND role = 'admin';

-- 2. Create a secure function to lookup email by Name and UID
-- This allows the frontend to log someone in using just their Name and UID
CREATE OR REPLACE FUNCTION lookup_user_email(p_role TEXT, p_name TEXT, p_uid TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
BEGIN
  IF p_role = 'teacher' OR p_role = 'admin' THEN
    -- Look up teacher/admin in profiles
    SELECT id INTO v_user_id FROM public.profiles WHERE name ILIKE p_name AND uid = p_uid;
  ELSIF p_role = 'student' THEN
    -- Look up student
    -- We assume student emails are formatted as uid@gn.cloud internally
    SELECT id INTO v_user_id FROM public.students WHERE name ILIKE p_name AND uid = p_uid;
    IF FOUND THEN
      RETURN p_uid || '@gn.cloud';
    END IF;
  END IF;

  IF v_user_id IS NOT NULL THEN
    -- Get their email from auth.users (Security Definer allows this)
    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    RETURN v_email;
  END IF;

  RETURN NULL;
END;
$$;

-- 3. We also need to automatically set the password to their UID for this to work.
-- NOTE: For existing teachers, you might need to manually update their passwords in the Supabase Dashboard to match their new UID.
-- For new students/teachers, their passwords will need to be set to their UID upon creation.

-- Let's create the Python Portal tables while we're at it (Phase 3)
CREATE TABLE IF NOT EXISTS public.python_lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT,
  content TEXT, -- HTML or markdown content
  video_url TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.python_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  module TEXT NOT NULL,
  instructions TEXT NOT NULL,
  starter_code TEXT,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.python_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES public.python_assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  status TEXT DEFAULT 'submitted', -- submitted, reviewed
  teacher_feedback TEXT,
  corrected_code TEXT,
  marks NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Python Portal
ALTER TABLE public.python_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.python_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.python_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anyone to read python lessons" ON public.python_lessons FOR SELECT USING (true);
CREATE POLICY "Allow teachers to manage python lessons" ON public.python_lessons FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'teacher' OR role = 'admin'));

CREATE POLICY "Allow anyone to read python assignments" ON public.python_assignments FOR SELECT USING (true);
CREATE POLICY "Allow teachers to manage python assignments" ON public.python_assignments FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'teacher' OR role = 'admin'));

CREATE POLICY "Allow authenticated read python submissions" ON public.python_submissions FOR SELECT USING (true);
CREATE POLICY "Allow students to insert python submissions" ON public.python_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow teachers to update python submissions" ON public.python_submissions FOR UPDATE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'teacher' OR role = 'admin'));
