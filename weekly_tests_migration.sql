-- weekly_tests_migration.sql

-- 1. App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Insert default pass percentage
INSERT INTO public.app_settings (key, value) 
VALUES ('weekly_test_pass_percentage', '40')
ON CONFLICT (key) DO NOTHING;

-- 2. Weekly Tests Table
CREATE TABLE IF NOT EXISTS public.weekly_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    test_date DATE NOT NULL,
    max_marks NUMERIC NOT NULL CHECK (max_marks > 0),
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, subject_id, test_date)
);

-- 3. Weekly Test Marks Table
CREATE TABLE IF NOT EXISTS public.weekly_test_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES public.weekly_tests(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    score NUMERIC CHECK (score >= 0),
    is_absent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(test_id, student_id)
);

-- 4. Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_test_marks ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Settings: Anyone authenticated can read, only admin can update
CREATE POLICY "Allow authenticated read app_settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin update app_settings" ON public.app_settings FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Allow admin insert app_settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Weekly Tests:
-- Teachers can select their own tests, Admins/Principals can select all tests.
CREATE POLICY "Allow authenticated read weekly_tests" ON public.weekly_tests FOR SELECT TO authenticated USING (true);

-- Teachers can insert their own tests
CREATE POLICY "Allow teacher insert weekly_tests" ON public.weekly_tests FOR INSERT TO authenticated WITH CHECK (
    teacher_id = auth.uid()
);

-- Teachers can update their own tests if Draft. Admins/Principals can update status.
CREATE POLICY "Allow teacher update draft weekly_tests" ON public.weekly_tests FOR UPDATE TO authenticated USING (
    (teacher_id = auth.uid() AND status = 'Draft') OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'principal'))
);

-- Teachers can delete their own tests if Draft
CREATE POLICY "Allow teacher delete draft weekly_tests" ON public.weekly_tests FOR DELETE TO authenticated USING (
    teacher_id = auth.uid() AND status = 'Draft'
);

-- Weekly Test Marks:
CREATE POLICY "Allow authenticated read weekly_test_marks" ON public.weekly_test_marks FOR SELECT TO authenticated USING (true);

-- Teachers can insert marks for their tests if Draft
CREATE POLICY "Allow teacher insert weekly_test_marks" ON public.weekly_test_marks FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.weekly_tests WHERE id = test_id AND teacher_id = auth.uid() AND status = 'Draft')
);

-- Teachers can update marks for their tests if Draft
CREATE POLICY "Allow teacher update weekly_test_marks" ON public.weekly_test_marks FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.weekly_tests WHERE id = test_id AND teacher_id = auth.uid() AND status = 'Draft')
);

-- Teachers can delete marks
CREATE POLICY "Allow teacher delete weekly_test_marks" ON public.weekly_test_marks FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.weekly_tests WHERE id = test_id AND teacher_id = auth.uid() AND status = 'Draft')
);
