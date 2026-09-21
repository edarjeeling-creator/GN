-- ==============================================================================
-- GYANODAY NIKETAN ERP: CONSOLIDATED SENIOR SCHOOL WEEKLY TEST REPORT
-- Optional Persistence Tables Migration (PostgreSQL / Supabase Studio)
-- ==============================================================================

-- 1. Weekly Test Cycles Table (Master entity for each Tuesday Weekly Test Event)
CREATE TABLE IF NOT EXISTS public.weekly_test_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_code TEXT NOT NULL UNIQUE,
    academic_year TEXT NOT NULL DEFAULT '2026',
    test_date DATE NOT NULL,
    week_identifier TEXT NOT NULL,
    test_name TEXT NOT NULL,
    term TEXT DEFAULT 'Finalterm',
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

-- 2. Consolidated Weekly Test Reports Table (Immutable versioned snapshots)
CREATE TABLE IF NOT EXISTS public.weekly_test_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES public.weekly_test_cycles(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL DEFAULT '2026',
    term TEXT NOT NULL DEFAULT 'Finalterm',
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

-- Safely ensure term column exists if table was already partially created
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_test_reports' AND column_name='term') THEN
        ALTER TABLE public.weekly_test_reports ADD COLUMN term TEXT NOT NULL DEFAULT 'Finalterm';
    END IF;
END $$;

-- 3. Weekly Test Audit Logs
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

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.weekly_test_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_test_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_test_audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. Policies
DROP POLICY IF EXISTS "Allow authenticated read weekly_test_cycles" ON public.weekly_test_cycles;
CREATE POLICY "Allow authenticated read weekly_test_cycles" ON public.weekly_test_cycles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow staff manage weekly_test_cycles" ON public.weekly_test_cycles;
CREATE POLICY "Allow staff manage weekly_test_cycles" ON public.weekly_test_cycles FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'principal', 'coordinator', 'teacher'))
);

DROP POLICY IF EXISTS "Allow authenticated read weekly_test_reports" ON public.weekly_test_reports;
CREATE POLICY "Allow authenticated read weekly_test_reports" ON public.weekly_test_reports FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow staff manage weekly_test_reports" ON public.weekly_test_reports;
CREATE POLICY "Allow staff manage weekly_test_reports" ON public.weekly_test_reports FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'principal', 'coordinator'))
);

DROP POLICY IF EXISTS "Allow admin read weekly_test_audit_logs" ON public.weekly_test_audit_logs;
CREATE POLICY "Allow admin read weekly_test_audit_logs" ON public.weekly_test_audit_logs FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'principal', 'coordinator'))
);

DROP POLICY IF EXISTS "Allow authenticated insert weekly_test_audit_logs" ON public.weekly_test_audit_logs;
CREATE POLICY "Allow authenticated insert weekly_test_audit_logs" ON public.weekly_test_audit_logs FOR INSERT TO authenticated WITH CHECK (true);
