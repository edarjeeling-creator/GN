-- Routine Engine Migration Script

-- 1. Teacher Metadata
CREATE TABLE public.teacher_metadata (
    teacher_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    department TEXT,
    max_periods_per_day INTEGER DEFAULT 6,
    can_take_substitution BOOLEAN DEFAULT true,
    availability_start_period INTEGER DEFAULT 1,
    availability_end_period INTEGER DEFAULT 9,
    is_class_teacher BOOLEAN DEFAULT false,
    class_teacher_of UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.teacher_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read teacher_metadata" ON public.teacher_metadata FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated all teacher_metadata" ON public.teacher_metadata FOR ALL TO authenticated USING (true);


-- 2. Master Routine
CREATE TABLE public.master_routine (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Monday
    period_num INTEGER NOT NULL CHECK (period_num BETWEEN 1 AND 9),
    is_practical BOOLEAN DEFAULT false,
    modifier_tags TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(teacher_id, day_of_week, period_num),
    UNIQUE(class_id, day_of_week, period_num)
);
ALTER TABLE public.master_routine ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read master_routine" ON public.master_routine FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated all master_routine" ON public.master_routine FOR ALL TO authenticated USING (true);


-- 3. Teacher Attendance
CREATE TABLE public.teacher_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Half-Day-Morning', 'Half-Day-Afternoon', 'Leave')),
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(teacher_id, date)
);
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read teacher_attendance" ON public.teacher_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated all teacher_attendance" ON public.teacher_attendance FOR ALL TO authenticated USING (true);


-- 4. Daily Routine Delta
CREATE TABLE public.daily_routine_delta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    master_routine_id UUID NOT NULL REFERENCES public.master_routine(id) ON DELETE CASCADE,
    absent_teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    substitute_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    priority_used INTEGER,
    override_modifier TEXT,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, master_routine_id)
);
ALTER TABLE public.daily_routine_delta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read daily_routine_delta" ON public.daily_routine_delta FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated all daily_routine_delta" ON public.daily_routine_delta FOR ALL TO authenticated USING (true);
