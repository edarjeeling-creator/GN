-- 1. Attendance Logs
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_type TEXT NOT NULL CHECK (person_type IN ('student', 'teacher')),
  person_id UUID NOT NULL,
  scan_time TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL,
  device_name TEXT,
  gate TEXT,
  scanner_user UUID REFERENCES auth.users(id),
  operator_name TEXT,
  remarks TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_person_time ON public.attendance_logs(person_id, scan_time);

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read attendance_logs" ON public.attendance_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated all attendance_logs" ON public.attendance_logs FOR ALL TO authenticated USING (true);

-- 2. Teacher Attendance (with correct columns)
CREATE TABLE IF NOT EXISTS public.teacher_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status TEXT NOT NULL,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(teacher_id, attendance_date)
);
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read teacher_attendance" ON public.teacher_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated all teacher_attendance" ON public.teacher_attendance FOR ALL TO authenticated USING (true);
