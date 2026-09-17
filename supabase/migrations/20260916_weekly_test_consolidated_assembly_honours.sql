-- ==============================================================================
-- GYANODAY NIKETAN ERP: CONSOLIDATED SENIOR SCHOOL WEEKLY TEST REPORT
-- & PRINCIPAL ASSEMBLY HONOURS SYSTEM MIGRATION
-- ==============================================================================

-- 1. Weekly Test Cycles Table (Master entity for each Tuesday Weekly Test Event)
CREATE TABLE IF NOT EXISTS public.weekly_test_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_code TEXT NOT NULL UNIQUE, -- e.g. 'WT-2026-09-08'
    academic_year TEXT NOT NULL DEFAULT '2026',
    test_date DATE NOT NULL,
    week_identifier TEXT NOT NULL, -- e.g. 'Week 37'
    test_name TEXT NOT NULL, -- e.g. 'Senior School Weekly Test — Week 37'
    term TEXT DEFAULT 'Midterm',
    applicable_classes JSONB NOT NULL DEFAULT '["Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"]'::jsonb,
    applicable_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    applicable_subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED')),
    marks_entry_deadline TIMESTAMPTZ,
    report_generation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (report_generation_status IN ('PENDING', 'GENERATED', 'REVISED')),
    current_report_version INTEGER DEFAULT 1,
    report_generated_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Extend Weekly Tests Table with Cycle and Progress Tracking
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

-- Safely add extension columns to weekly_tests
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_tests' AND column_name='cycle_id') THEN
        ALTER TABLE public.weekly_tests ADD COLUMN cycle_id UUID REFERENCES public.weekly_test_cycles(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_tests' AND column_name='marks_entered_count') THEN
        ALTER TABLE public.weekly_tests ADD COLUMN marks_entered_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_tests' AND column_name='marks_pending_count') THEN
        ALTER TABLE public.weekly_tests ADD COLUMN marks_pending_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_tests' AND column_name='absent_count') THEN
        ALTER TABLE public.weekly_tests ADD COLUMN absent_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_tests' AND column_name='total_students_count') THEN
        ALTER TABLE public.weekly_tests ADD COLUMN total_students_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_tests' AND column_name='submitted_at') THEN
        ALTER TABLE public.weekly_tests ADD COLUMN submitted_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_tests' AND column_name='approved_by') THEN
        ALTER TABLE public.weekly_tests ADD COLUMN approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_tests' AND column_name='submission_notes') THEN
        ALTER TABLE public.weekly_tests ADD COLUMN submission_notes TEXT;
    END IF;
END $$;

-- 3. Extend Weekly Test Marks Table
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

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_test_marks' AND column_name='is_na') THEN
        ALTER TABLE public.weekly_test_marks ADD COLUMN is_na BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_test_marks' AND column_name='entered_by') THEN
        ALTER TABLE public.weekly_test_marks ADD COLUMN entered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_test_marks' AND column_name='updated_by') THEN
        ALTER TABLE public.weekly_test_marks ADD COLUMN updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Consolidated Weekly Test Reports Table (Immutable versioned snapshots)
CREATE TABLE IF NOT EXISTS public.weekly_test_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES public.weekly_test_cycles(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL DEFAULT '2026',
    test_date DATE NOT NULL,
    week_identifier TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'FINAL', 'REVISED')),
    is_current_final BOOLEAN DEFAULT FALSE,
    summary_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    honours_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    requires_attention_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    class_details_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_submissions_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    config_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    pdf_filename TEXT,
    generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    revision_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(academic_year, cycle_id, version)
);

-- 5. Weekly Test Audit Logs
CREATE TABLE IF NOT EXISTS public.weekly_test_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID REFERENCES public.weekly_test_cycles(id) ON DELETE CASCADE,
    report_id UUID REFERENCES public.weekly_test_reports(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_role TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    old_state JSONB,
    new_state JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Insert Default Configuration in app_settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.app_settings (key, value)
VALUES (
    'weekly_test_config',
    '{
        "reporting_enabled": true,
        "applicable_classes": ["Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"],
        "applicable_sections": [],
        "included_subjects_mode": "ALL_ASSIGNED",
        "required_subjects": [],
        "excluded_subjects": [],
        "marks_completion_requirement": "ALL_REQUIRED",
        "requires_attention_threshold": 10,
        "threshold_type": "SCORE",
        "requires_attention_label": "Requires Attention (Below 10)",
        "ranking_policy": "DENSE",
        "exclude_absent_from_ranking": true,
        "exclude_na_from_ranking": true,
        "coordinator_review_mode": "EXEMPT",
        "report_generation_day": "MONDAY",
        "report_generation_time": "08:00",
        "school_branding": {
            "school_name": "Gyanoday Niketan",
            "section_name": "Senior School",
            "report_title": "WEEKLY TEST REPORT"
        },
        "whatsapp_notification_enabled": true,
        "whatsapp_message_template": "🏫 *GYANODAY NIKETAN — WEEKLY TEST REPORT*\\n\\nThe consolidated Senior School Weekly Test Report for *{{week}}* (Test Date: {{date}}) is ready in the Principal Portal.\\n\\nStatus: 🟢 FINAL\\nVersion: {{version}}\\n\\nPlease review it in the Principal Portal prior to Tuesday Morning Assembly."
    }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value
WHERE app_settings.key = 'weekly_test_config' AND app_settings.value IS NULL;

-- 7. Enable RLS
ALTER TABLE public.weekly_test_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_test_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_test_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_test_audit_logs ENABLE ROW LEVEL SECURITY;

-- 8. Policies
-- Weekly Test Cycles: Read by all authenticated users; modified by admin/principal/coordinator
DROP POLICY IF EXISTS "Allow authenticated read weekly_test_cycles" ON public.weekly_test_cycles;
CREATE POLICY "Allow authenticated read weekly_test_cycles" ON public.weekly_test_cycles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow staff manage weekly_test_cycles" ON public.weekly_test_cycles;
CREATE POLICY "Allow staff manage weekly_test_cycles" ON public.weekly_test_cycles FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'principal', 'coordinator', 'teacher'))
);

-- Weekly Test Reports: Read by authenticated; created by admin/principal/coordinator
DROP POLICY IF EXISTS "Allow authenticated read weekly_test_reports" ON public.weekly_test_reports;
CREATE POLICY "Allow authenticated read weekly_test_reports" ON public.weekly_test_reports FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow staff manage weekly_test_reports" ON public.weekly_test_reports;
CREATE POLICY "Allow staff manage weekly_test_reports" ON public.weekly_test_reports FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'principal', 'coordinator'))
);

-- Audit logs: Read by admin/principal; insert by authenticated
DROP POLICY IF EXISTS "Allow admin read weekly_test_audit_logs" ON public.weekly_test_audit_logs;
CREATE POLICY "Allow admin read weekly_test_audit_logs" ON public.weekly_test_audit_logs FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'principal', 'coordinator'))
);

DROP POLICY IF EXISTS "Allow authenticated insert weekly_test_audit_logs" ON public.weekly_test_audit_logs;
CREATE POLICY "Allow authenticated insert weekly_test_audit_logs" ON public.weekly_test_audit_logs FOR INSERT TO authenticated WITH CHECK (true);
