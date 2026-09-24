-- ==============================================================================
-- GYANODAY NIKETAN ERP: PRINCIPAL ROUTINE MANAGEMENT & AUTOMATIC DISTRIBUTION
-- Authoritative Master Routine, Versioning, Acknowledgement & Audit Migration
-- Idempotent & Fully Resilient (Handles clean installs + existing tables)
-- ==============================================================================

-- 1. Period Configuration Table (Configurable school periods, start/end times)
CREATE TABLE IF NOT EXISTS public.period_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID,
    campus_id UUID,
    period_num INTEGER NOT NULL CHECK (period_num BETWEEN 1 AND 12),
    period_name TEXT NOT NULL,
    start_time TEXT NOT NULL, -- e.g. "08:00"
    end_time TEXT NOT NULL,   -- e.g. "08:40"
    is_break BOOLEAN DEFAULT false,
    is_special BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    day_applicability JSONB DEFAULT '[1, 2, 3, 4, 5]'::jsonb, -- Mon-Fri
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_num)
);

ALTER TABLE public.period_configurations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow read period_configurations" ON public.period_configurations;
    DROP POLICY IF EXISTS "Allow write period_configurations" ON public.period_configurations;
    CREATE POLICY "Allow read period_configurations" ON public.period_configurations FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Allow write period_configurations" ON public.period_configurations FOR ALL TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- 2. Routine Versions Table (Tracks V1, V2, V3, Drafts, Published, Superseded)
CREATE TABLE IF NOT EXISTS public.routine_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year TEXT NOT NULL DEFAULT '2026',
    campus_id UUID,
    campus_name TEXT DEFAULT 'Senior School',
    version_code TEXT NOT NULL DEFAULT 'V1',
    version_num INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'VALIDATED', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED')),
    change_reason TEXT,
    summary_stats JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.routine_versions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow read routine_versions" ON public.routine_versions;
    DROP POLICY IF EXISTS "Allow write routine_versions" ON public.routine_versions;
    CREATE POLICY "Allow read routine_versions" ON public.routine_versions FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Allow write routine_versions" ON public.routine_versions FOR ALL TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- 3. Master Routine Entries Table (Single authoritative dataset for entire school)
CREATE TABLE IF NOT EXISTS public.master_routine (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID REFERENCES public.routine_versions(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL DEFAULT '2026',
    campus_id UUID,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    period_num INTEGER NOT NULL CHECK (period_num BETWEEN 1 AND 12),
    period_name TEXT NOT NULL DEFAULT '1st Period',
    start_time TEXT,
    end_time TEXT,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    teacher_name TEXT,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    class_name TEXT,
    section TEXT,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    subject_name TEXT,
    entry_type TEXT NOT NULL DEFAULT 'SUBJECT',
    room TEXT,
    notes TEXT,
    is_practical BOOLEAN DEFAULT false,
    modifier_tags TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely ensure all columns exist even if master_routine already existed from a previous migration
DO $$ BEGIN
    ALTER TABLE public.master_routine ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES public.routine_versions(id) ON DELETE CASCADE;
    ALTER TABLE public.master_routine ADD COLUMN IF NOT EXISTS academic_year TEXT NOT NULL DEFAULT '2026';
    ALTER TABLE public.master_routine ADD COLUMN IF NOT EXISTS campus_id UUID;
    ALTER TABLE public.master_routine ADD COLUMN IF NOT EXISTS period_name TEXT NOT NULL DEFAULT '1st Period';
    ALTER TABLE public.master_routine ADD COLUMN IF NOT EXISTS start_time TEXT;
    ALTER TABLE public.master_routine ADD COLUMN IF NOT EXISTS end_time TEXT;
    ALTER TABLE public.master_routine ADD COLUMN IF NOT EXISTS teacher_name TEXT;
    ALTER TABLE public.master_routine ADD COLUMN IF NOT EXISTS class_name TEXT;
    ALTER TABLE public.master_routine ADD COLUMN IF NOT EXISTS section TEXT;
    ALTER TABLE public.master_routine ADD COLUMN IF NOT EXISTS subject_name TEXT;
    ALTER TABLE public.master_routine ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'SUBJECT';
    ALTER TABLE public.master_routine ADD COLUMN IF NOT EXISTS room TEXT;
    ALTER TABLE public.master_routine ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE public.master_routine ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Adjust unique constraints safely to include version_id
DO $$ BEGIN
    -- Drop old unversioned constraints if they exist
    ALTER TABLE public.master_routine DROP CONSTRAINT IF EXISTS master_routine_teacher_id_day_of_week_period_num_key;
    ALTER TABLE public.master_routine DROP CONSTRAINT IF EXISTS master_routine_class_id_day_of_week_period_num_key;
    
    -- Add versioned unique constraints if they do not exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'master_routine_version_teacher_day_period_key'
    ) THEN
        ALTER TABLE public.master_routine ADD CONSTRAINT master_routine_version_teacher_day_period_key 
            UNIQUE (version_id, teacher_id, day_of_week, period_num);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'master_routine_version_class_day_period_key'
    ) THEN
        ALTER TABLE public.master_routine ADD CONSTRAINT master_routine_version_class_day_period_key 
            UNIQUE (version_id, class_id, day_of_week, period_num);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.master_routine ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow read master_routine" ON public.master_routine;
    DROP POLICY IF EXISTS "Allow write master_routine" ON public.master_routine;
    CREATE POLICY "Allow read master_routine" ON public.master_routine FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Allow write master_routine" ON public.master_routine FOR ALL TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- 4. Routine Acknowledgements Table (Tracks teacher viewing & formal acknowledgement)
CREATE TABLE IF NOT EXISTS public.routine_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.routine_versions(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    teacher_name TEXT,
    viewed_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    acknowledgement_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely ensure columns exist if routine_acknowledgements was already partially created
DO $$ BEGIN
    ALTER TABLE public.routine_acknowledgements ADD COLUMN IF NOT EXISTS teacher_name TEXT;
    ALTER TABLE public.routine_acknowledgements ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
    ALTER TABLE public.routine_acknowledgements ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
    ALTER TABLE public.routine_acknowledgements ADD COLUMN IF NOT EXISTS acknowledgement_notes TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'routine_acknowledgements_version_teacher_key'
    ) THEN
        ALTER TABLE public.routine_acknowledgements ADD CONSTRAINT routine_acknowledgements_version_teacher_key 
            UNIQUE (version_id, teacher_id);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.routine_acknowledgements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow read routine_acknowledgements" ON public.routine_acknowledgements;
    DROP POLICY IF EXISTS "Allow write routine_acknowledgements" ON public.routine_acknowledgements;
    CREATE POLICY "Allow read routine_acknowledgements" ON public.routine_acknowledgements FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Allow write routine_acknowledgements" ON public.routine_acknowledgements FOR ALL TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- 5. Routine Audit Logs Table (Full historical trace of creates, edits, publishes, changes)
CREATE TABLE IF NOT EXISTS public.routine_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID REFERENCES public.routine_versions(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- ROUTINE_CREATED, ROUTINE_EDITED, ROUTINE_PUBLISHED, etc.
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    performer_name TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.routine_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow read routine_audit_logs" ON public.routine_audit_logs;
    DROP POLICY IF EXISTS "Allow write routine_audit_logs" ON public.routine_audit_logs;
    CREATE POLICY "Allow read routine_audit_logs" ON public.routine_audit_logs FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Allow write routine_audit_logs" ON public.routine_audit_logs FOR ALL TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- 6. Indexes for ultra-fast queries
CREATE INDEX IF NOT EXISTS idx_master_routine_lookup ON public.master_routine(version_id, day_of_week, period_num);
CREATE INDEX IF NOT EXISTS idx_master_routine_teacher ON public.master_routine(version_id, teacher_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_master_routine_class ON public.master_routine(version_id, class_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_routine_ack_teacher ON public.routine_acknowledgements(version_id, teacher_id);
