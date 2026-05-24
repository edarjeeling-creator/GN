-- Run this in your Supabase SQL Editor

-- 1. Create Tables
CREATE TABLE public.classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  section TEXT NOT NULL,
  academic_year TEXT DEFAULT '2026',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  roll_no INTEGER NOT NULL,
  name TEXT NOT NULL,
  uid TEXT UNIQUE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  second_language TEXT,
  third_language TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.teacher_subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  UNIQUE(teacher_id, class_id, subject_id)
);

CREATE TABLE public.marks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  score NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id, term)
);

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'teacher', -- 'teacher' or 'admin'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Half Day', 'Leave')),
  remarks TEXT,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

CREATE TABLE public.news (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Setup RLS (Row Level Security)
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Adjust these based on exact security needs)
-- Allow anyone authenticated to read classes, subjects, students
CREATE POLICY "Allow authenticated read classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read students" ON public.students FOR SELECT TO authenticated USING (true);

-- Teachers can read their assigned subjects
CREATE POLICY "Allow teachers read assignments" ON public.teacher_subjects FOR SELECT TO authenticated USING (true);

-- Marks policies: Teachers can read all marks (or restrict to their subjects if needed), insert and update
CREATE POLICY "Allow authenticated read marks" ON public.marks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert marks" ON public.marks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update marks" ON public.marks FOR UPDATE TO authenticated USING (true);

-- Attendance policies
CREATE POLICY "Allow authenticated read attendance" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update attendance" ON public.attendance FOR UPDATE TO authenticated USING (true);

-- Profiles
CREATE POLICY "Allow authenticated read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

-- News
CREATE POLICY "Allow anonymous read news" ON public.news FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert news" ON public.news FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update news" ON public.news FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete news" ON public.news FOR DELETE TO authenticated USING (true);

-- Create a trigger to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', COALESCE(new.raw_user_meta_data->>'role', 'teacher'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable Realtime on the marks and attendance tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.marks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;

-- 3. Security Definer RPC for Public Student Portal
CREATE OR REPLACE FUNCTION get_student_report(p_uid TEXT, p_academic_year TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student RECORD;
  v_class RECORD;
  v_marks JSONB;
  v_subjects JSONB;
  v_class_marks JSONB;
  v_attendance JSONB;
BEGIN
  SELECT * INTO v_student FROM public.students WHERE uid = p_uid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  
  SELECT * INTO v_class FROM public.classes WHERE id = v_student.class_id;
  
  SELECT jsonb_agg(m) INTO v_marks FROM public.marks m WHERE student_id = v_student.id AND term LIKE p_academic_year || '\_%';
  
  SELECT jsonb_agg(s) INTO v_subjects FROM public.subjects s;

  -- Get ALL marks for the entire class (anonymized) to calculate rank locally
  SELECT jsonb_agg(m) INTO v_class_marks 
  FROM public.marks m 
  JOIN public.students st ON m.student_id = st.id
  WHERE st.class_id = v_class.id AND m.term LIKE p_academic_year || '\_%';

  -- Get attendance for the student
  SELECT jsonb_agg(a) INTO v_attendance 
  FROM public.attendance a 
  WHERE a.student_id = v_student.id AND a.academic_year = p_academic_year;

  RETURN jsonb_build_object(
    'student', row_to_json(v_student), 
    'class', row_to_json(v_class), 
    'marks', v_marks, 
    'subjects', v_subjects,
    'class_marks', v_class_marks,
    'attendance', COALESCE(v_attendance, '[]'::jsonb)
  );
END;
$$;

-- 4. Security Definer RPC for Principal Portal
CREATE OR REPLACE FUNCTION search_students_by_principal(p_pin TEXT, p_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_results JSONB;
BEGIN
  -- Check if PIN is correct (e.g., hardcoded '999999' or from a settings table)
  IF p_pin != '999999' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'uid', s.uid,
      'roll_no', s.roll_no,
      'class_name', c.name,
      'class_section', c.section
    )
  ) INTO v_results
  FROM public.students s
  JOIN public.classes c ON s.class_id = c.id
  WHERE s.name ILIKE '%' || p_query || '%';

  RETURN COALESCE(v_results, '[]');
END;
$$;

-- Phase 8 Additions
CREATE TABLE IF NOT EXISTS public.faculty (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  designation TEXT NOT NULL,
  department TEXT NOT NULL,
  bio TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.gallery (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Faculty
ALTER TABLE public.faculty ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users on faculty" ON public.faculty FOR SELECT USING (true);
CREATE POLICY "Enable all access for authenticated users on faculty" ON public.faculty FOR ALL USING (auth.role() = 'authenticated');

-- RLS for Gallery
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users on gallery" ON public.gallery FOR SELECT USING (true);
CREATE POLICY "Enable all access for authenticated users on gallery" ON public.gallery FOR ALL USING (auth.role() = 'authenticated');
