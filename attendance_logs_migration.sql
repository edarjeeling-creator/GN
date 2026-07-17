CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_type TEXT NOT NULL CHECK (person_type IN ('student', 'teacher')),
  person_id UUID NOT NULL,
  scan_time TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('Present', 'Late', 'Half Day', 'Leave', 'Absent', 'Cancelled')),
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
CREATE POLICY "Allow authenticated insert attendance_logs" ON public.attendance_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update attendance_logs" ON public.attendance_logs FOR UPDATE TO authenticated USING (true);
