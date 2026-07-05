-- SaaS Multi-Tenant Migration Script
-- Run this in your Supabase SQL Editor to transform the database into a multi-tenant SaaS platform.

-- 1. Create the central 'schools' table
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_name TEXT NOT NULL,
  custom_domain TEXT UNIQUE NOT NULL,
  subscription_plan TEXT DEFAULT 'Basic' CHECK (subscription_plan IN ('Basic', 'Premium', 'Enterprise')),
  subscription_start TIMESTAMPTZ DEFAULT NOW(),
  subscription_end TIMESTAMPTZ,
  license_status TEXT DEFAULT 'active' CHECK (license_status IN ('active', 'warning', 'grace', 'limited', 'read_only', 'suspended')),
  allowed_students INTEGER DEFAULT 500,
  allowed_teachers INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on schools
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Allow public read of schools (needed for resolving hostname to school_id before logging in)
CREATE POLICY "Allow public read of schools" ON public.schools FOR SELECT USING (true);

-- Allow admins/super-admins to modify schools if needed
CREATE POLICY "Allow authenticated manage of schools" ON public.schools FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Create the default mock school for local development and existing data
INSERT INTO public.schools (id, school_name, custom_domain, subscription_plan, license_status, allowed_students, allowed_teachers)
VALUES (
  'd3b07384-d113-4956-a5ec-9af2c61146e5',
  'SmartGrades HQ',
  'localhost',
  'Enterprise',
  'active',
  9999,
  999
) ON CONFLICT (custom_domain) DO UPDATE 
SET school_name = EXCLUDED.school_name, subscription_plan = EXCLUDED.subscription_plan;

-- 3. Update existing tables to add school_id with a default pointing to the mock school
-- This ensures existing data is preserved and associated with the default tenant automatically.

-- Table: site_settings
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT,
  school_id UUID REFERENCES public.schools(id) DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(key, school_id)
);

-- Table: profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5';

-- Table: classes
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5';

-- Table: subjects
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5';

-- Table: students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5';

-- Table: teacher_subjects
ALTER TABLE public.teacher_subjects ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5';

-- Table: marks
ALTER TABLE public.marks ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5';

-- Table: attendance
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5';

-- Table: news
ALTER TABLE public.news ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5';

-- Table: faculty
ALTER TABLE public.faculty ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5';

-- Table: gallery
ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5';

-- Table: python_lessons
CREATE TABLE IF NOT EXISTS public.python_lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  order_index INTEGER DEFAULT 0,
  school_id UUID REFERENCES public.schools(id) DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: python_assignments
CREATE TABLE IF NOT EXISTS public.python_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES public.python_lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  school_id UUID REFERENCES public.schools(id) DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: python_submissions
CREATE TABLE IF NOT EXISTS public.python_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES public.python_assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  code TEXT,
  score NUMERIC,
  feedback TEXT,
  school_id UUID REFERENCES public.schools(id) DEFAULT 'd3b07384-d113-4956-a5ec-9af2c61146e5',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);


-- 4. Update the handle_new_user trigger function to set the school_id
-- We will read the school_id from user raw metadata during registration.
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, school_id)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Unnamed Teacher'), 
    COALESCE(new.raw_user_meta_data->>'role', 'teacher'),
    COALESCE((new.raw_user_meta_data->>'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Revamp Row Level Security (RLS) policies to enforce tenant isolation.
-- Users must only access data corresponding to their school_id.

-- Drop old policies to avoid conflict
DROP POLICY IF EXISTS "Allow authenticated read classes" ON public.classes;
DROP POLICY IF EXISTS "Allow authenticated read subjects" ON public.subjects;
DROP POLICY IF EXISTS "Allow authenticated read students" ON public.students;
DROP POLICY IF EXISTS "Allow teachers read assignments" ON public.teacher_subjects;
DROP POLICY IF EXISTS "Allow authenticated read marks" ON public.marks;
DROP POLICY IF EXISTS "Allow authenticated insert marks" ON public.marks;
DROP POLICY IF EXISTS "Allow authenticated update marks" ON public.marks;
DROP POLICY IF EXISTS "Allow authenticated read attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow authenticated insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow authenticated update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anonymous read news" ON public.news;
DROP POLICY IF EXISTS "Allow authenticated insert news" ON public.news;
DROP POLICY IF EXISTS "Allow authenticated update news" ON public.news;
DROP POLICY IF EXISTS "Allow authenticated delete news" ON public.news;
DROP POLICY IF EXISTS "Enable read access for all users on faculty" ON public.faculty;
DROP POLICY IF EXISTS "Enable all access for authenticated users on faculty" ON public.faculty;
DROP POLICY IF EXISTS "Enable read access for all users on gallery" ON public.gallery;
DROP POLICY IF EXISTS "Enable all access for authenticated users on gallery" ON public.gallery;

-- Helper to check user school_id matching
-- Since Supabase Custom Claims or metadata can be read inside RLS from `auth.jwt() ->> 'raw_user_meta_data'`, let's construct highly performant policies:
-- We assume school_id is embedded in the JWT user metadata.

-- Classes
CREATE POLICY "Classes multi-tenant select" ON public.classes FOR SELECT TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Classes multi-tenant insert" ON public.classes FOR INSERT TO authenticated
  WITH CHECK (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Classes multi-tenant update" ON public.classes FOR UPDATE TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Classes multi-tenant delete" ON public.classes FOR DELETE TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));

-- Subjects
CREATE POLICY "Subjects multi-tenant select" ON public.subjects FOR SELECT TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Subjects multi-tenant insert" ON public.subjects FOR INSERT TO authenticated
  WITH CHECK (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Subjects multi-tenant delete" ON public.subjects FOR DELETE TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));

-- Students
CREATE POLICY "Students multi-tenant select" ON public.students FOR SELECT TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Students multi-tenant insert" ON public.students FOR INSERT TO authenticated
  WITH CHECK (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Students multi-tenant update" ON public.students FOR UPDATE TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Students multi-tenant delete" ON public.students FOR DELETE TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));

-- Teacher Subjects
CREATE POLICY "Teacher Subjects multi-tenant select" ON public.teacher_subjects FOR SELECT TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Teacher Subjects multi-tenant insert" ON public.teacher_subjects FOR INSERT TO authenticated
  WITH CHECK (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Teacher Subjects multi-tenant delete" ON public.teacher_subjects FOR DELETE TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));

-- Marks
CREATE POLICY "Marks multi-tenant select" ON public.marks FOR SELECT TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Marks multi-tenant insert" ON public.marks FOR INSERT TO authenticated
  WITH CHECK (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Marks multi-tenant update" ON public.marks FOR UPDATE TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Marks multi-tenant delete" ON public.marks FOR DELETE TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));

-- Attendance
CREATE POLICY "Attendance multi-tenant select" ON public.attendance FOR SELECT TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Attendance multi-tenant insert" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Attendance multi-tenant update" ON public.attendance FOR UPDATE TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));

-- Profiles
CREATE POLICY "Profiles multi-tenant select" ON public.profiles FOR SELECT TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
CREATE POLICY "Profiles multi-tenant update" ON public.profiles FOR UPDATE TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));

-- Site Settings (Public reads public stuff or reads via active school domain)
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Site Settings public select" ON public.site_settings;
CREATE POLICY "Site Settings public select" ON public.site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Site Settings multi-tenant manage" ON public.site_settings;
CREATE POLICY "Site Settings multi-tenant manage" ON public.site_settings FOR ALL TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'))
  WITH CHECK (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));

-- News
DROP POLICY IF EXISTS "News public select" ON public.news;
CREATE POLICY "News public select" ON public.news FOR SELECT USING (true);
DROP POLICY IF EXISTS "News multi-tenant manage" ON public.news;
CREATE POLICY "News multi-tenant manage" ON public.news FOR ALL TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'))
  WITH CHECK (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));

-- Faculty
DROP POLICY IF EXISTS "Faculty public select" ON public.faculty;
CREATE POLICY "Faculty public select" ON public.faculty FOR SELECT USING (true);
DROP POLICY IF EXISTS "Faculty multi-tenant manage" ON public.faculty;
CREATE POLICY "Faculty multi-tenant manage" ON public.faculty FOR ALL TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'))
  WITH CHECK (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));

-- Gallery
DROP POLICY IF EXISTS "Gallery public select" ON public.gallery;
CREATE POLICY "Gallery public select" ON public.gallery FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gallery multi-tenant manage" ON public.gallery;
CREATE POLICY "Gallery multi-tenant manage" ON public.gallery FOR ALL TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'))
  WITH CHECK (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));

-- Python Lessons
DROP POLICY IF EXISTS "Allow anyone to read python lessons" ON public.python_lessons;
DROP POLICY IF EXISTS "Allow teachers to manage python lessons" ON public.python_lessons;
DROP POLICY IF EXISTS "Python lessons public select" ON public.python_lessons;
CREATE POLICY "Python lessons public select" ON public.python_lessons FOR SELECT USING (true);
DROP POLICY IF EXISTS "Python lessons multi-tenant manage" ON public.python_lessons;
CREATE POLICY "Python lessons multi-tenant manage" ON public.python_lessons FOR ALL TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'))
  WITH CHECK (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));

-- Python Assignments
DROP POLICY IF EXISTS "Allow anyone to read python assignments" ON public.python_assignments;
DROP POLICY IF EXISTS "Allow teachers to manage python assignments" ON public.python_assignments;
DROP POLICY IF EXISTS "Python assignments public select" ON public.python_assignments;
CREATE POLICY "Python assignments public select" ON public.python_assignments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Python assignments multi-tenant manage" ON public.python_assignments;
CREATE POLICY "Python assignments multi-tenant manage" ON public.python_assignments FOR ALL TO authenticated
  USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'))
  WITH CHECK (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));

-- Python Submissions
DROP POLICY IF EXISTS "Allow authenticated read python submissions" ON public.python_submissions;
DROP POLICY IF EXISTS "Allow students to insert python submissions" ON public.python_submissions;
DROP POLICY IF EXISTS "Allow teachers to update python submissions" ON public.python_submissions;
DROP POLICY IF EXISTS "Python submissions multi-tenant select" ON public.python_submissions;
CREATE POLICY "Python submissions multi-tenant select" ON public.python_submissions FOR SELECT USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
DROP POLICY IF EXISTS "Python submissions multi-tenant insert" ON public.python_submissions;
CREATE POLICY "Python submissions multi-tenant insert" ON public.python_submissions FOR INSERT WITH CHECK (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
DROP POLICY IF EXISTS "Python submissions multi-tenant update" ON public.python_submissions;
CREATE POLICY "Python submissions multi-tenant update" ON public.python_submissions FOR UPDATE USING (school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5'));
