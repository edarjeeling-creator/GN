-- ==============================================================================
-- GYANODAY NIKETAN ERP: TEST & EXAMINATION MATTER COMMUNICATION CENTRE
-- MIGRATION: 20260917_test_exam_communication_centre.sql
-- ==============================================================================

-- 1. COMMUNICATION MASTER TABLE
CREATE TABLE IF NOT EXISTS public.test_exam_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year TEXT NOT NULL DEFAULT '2026',
    communication_type TEXT NOT NULL, 
    -- e.g. 'TEST_ANNOUNCEMENT', 'EXAM_ANNOUNCEMENT', 'TEST_PORTION', 'EXAM_PORTION', 
    -- 'TEST_INSTRUCTIONS', 'EXAM_INSTRUCTIONS', 'TEST_DATE_CHANGE', 'EXAM_DATE_CHANGE', 
    -- 'TEST_POSTPONEMENT', 'EXAM_POSTPONEMENT', 'REVISION_MATERIAL', 'PROJECT_ASSIGNMENT', 
    -- 'PRACTICAL_VIVA', 'IMPORTANT_REMINDER', 'GENERAL_ACADEMIC_NOTICE'
    
    scope_type TEXT NOT NULL CHECK (scope_type IN ('CLASS_SUBJECT', 'CLASS_WIDE', 'STUDENT_SPECIFIC', 'SCHOOL_WIDE')),
    
    -- Master-Data Links with ON DELETE SET NULL to preserve historical communications
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    section TEXT,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    weekly_test_id UUID REFERENCES public.weekly_tests(id) ON DELETE SET NULL,
    assessment_pattern_id UUID REFERENCES public.assessment_patterns(id) ON DELETE SET NULL,
    term TEXT,

    -- Immutable Historical Snapshots (survives master data renames/deletions)
    class_name_snapshot TEXT NOT NULL,
    section_snapshot TEXT,
    subject_name_snapshot TEXT,
    teacher_name_snapshot TEXT NOT NULL,
    test_title_snapshot TEXT,

    -- Notice Content
    title TEXT NOT NULL,
    message TEXT,
    test_exam_date DATE,
    action_date DATE, -- Submission deadline / project due date
    max_marks NUMERIC,
    portion_syllabus TEXT,
    portion_breakdown JSONB DEFAULT '[]'::jsonb, -- Structured [{chapter, topics: [], subtopics: []}]
    instructions TEXT,
    required_materials TEXT,
    room_venue TEXT,
    attachments JSONB DEFAULT '[]'::jsonb, -- Array of {name, url, path, size, type}
    
    -- Status & Priority
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL', 'IMPORTANT', 'URGENT')),
    status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'REVISED', 'CANCELLED', 'ARCHIVED')),
    acknowledgement_required BOOLEAN DEFAULT FALSE,
    
    -- Publishing & Expiry
    publish_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Non-Destructive Versioning (V1 -> V2)
    version INTEGER NOT NULL DEFAULT 1,
    parent_communication_id UUID REFERENCES public.test_exam_communications(id) ON DELETE SET NULL,
    is_latest BOOLEAN NOT NULL DEFAULT TRUE,
    change_reason TEXT,
    original_test_date DATE, -- Stored when date is changed/postponed
    
    -- Live Counter Aggregates (Updated atomically on recipient interaction)
    recipient_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    acknowledgement_count INTEGER DEFAULT 0,
    
    -- Author & Audit
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by_role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RECIPIENT SNAPSHOT TABLE (Created at Publish Time; Immutable historical record)
CREATE TABLE IF NOT EXISTS public.test_exam_communication_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_id UUID NOT NULL REFERENCES public.test_exam_communications(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    
    -- Snapshot values at publish time
    student_name_snapshot TEXT,
    student_roll_snapshot TEXT,
    class_name_snapshot TEXT,
    
    -- Interaction Tracking
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    parent_viewed BOOLEAN DEFAULT FALSE,
    parent_viewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(communication_id, student_id)
);

-- 3. IMMUTABLE AUDIT LOGS TABLE (ON DELETE SET NULL, NEVER CASCADE)
CREATE TABLE IF NOT EXISTS public.test_exam_communication_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_id UUID REFERENCES public.test_exam_communications(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_role TEXT NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL, -- e.g. 'CREATED', 'PUBLISHED', 'SCHEDULED', 'REVISED', 'DATE_CHANGED', 'POSTPONED', 'CANCELLED', 'ARCHIVED'
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ATTACHMENTS & SETTINGS IN APP_SETTINGS
INSERT INTO public.app_settings (key, value)
VALUES (
    'test_exam_communication_config',
    '{
        "max_attachment_size_mb": 10,
        "allowed_file_types": ["pdf", "jpg", "jpeg", "png", "doc", "docx"],
        "whatsapp_notification_enabled": true,
        "fcm_push_enabled": true,
        "allow_teacher_date_changes": true,
        "urgent_priority_roles": ["admin", "principal", "coordinator"]
    }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_tec_class_sub ON public.test_exam_communications(class_id, subject_id, status);
CREATE INDEX IF NOT EXISTS idx_tec_publish ON public.test_exam_communications(publish_at, status, is_latest);
CREATE INDEX IF NOT EXISTS idx_tec_weekly_test ON public.test_exam_communications(weekly_test_id);
CREATE INDEX IF NOT EXISTS idx_tecr_student ON public.test_exam_communication_recipients(student_id, is_read);
CREATE INDEX IF NOT EXISTS idx_tecr_comm ON public.test_exam_communication_recipients(communication_id);
CREATE INDEX IF NOT EXISTS idx_tecal_comm ON public.test_exam_communication_audit_logs(communication_id);

-- 6. IMMUTABILITY TRIGGER ON AUDIT LOGS
CREATE OR REPLACE FUNCTION trg_prevent_audit_log_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are strictly immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON public.test_exam_communication_audit_logs;
CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON public.test_exam_communication_audit_logs
FOR EACH ROW EXECUTE FUNCTION trg_prevent_audit_log_tampering();

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.test_exam_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_exam_communication_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_exam_communication_audit_logs ENABLE ROW LEVEL SECURITY;

-- 7.1 Communications SELECT:
-- Admins/Principals/Coordinators see all.
-- Teachers see communications they authored or for their assigned classes/subjects.
-- Students see communications where they are an assigned recipient.
CREATE POLICY "Communications SELECT Policy"
ON public.test_exam_communications FOR SELECT TO authenticated
USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'principal', 'coordinator')
    OR created_by = auth.uid()
    OR (
        status = 'PUBLISHED'
        AND publish_at <= NOW()
        AND EXISTS (
            SELECT 1 FROM public.test_exam_communication_recipients r
            WHERE r.communication_id = test_exam_communications.id
            AND r.student_id = auth.uid()
        )
    )
);

-- 7.2 Communications INSERT/UPDATE:
-- Only authenticated teachers, coordinators, principals, or admins.
CREATE POLICY "Communications INSERT Policy"
ON public.test_exam_communications FOR INSERT TO authenticated
WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'principal', 'coordinator', 'teacher')
);

CREATE POLICY "Communications UPDATE Policy"
ON public.test_exam_communications FOR UPDATE TO authenticated
USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'principal', 'coordinator')
    OR (created_by = auth.uid() AND status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED'))
);

-- DELETE on published communications is disallowed by policy (Must cancel/archive)
CREATE POLICY "Communications DELETE Policy"
ON public.test_exam_communications FOR DELETE TO authenticated
USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'principal')
        AND status = 'DRAFT'
    )
);

-- 7.3 Recipients SELECT & UPDATE:
-- Students can read their recipient record and update is_read/is_acknowledged.
CREATE POLICY "Recipients SELECT Policy"
ON public.test_exam_communication_recipients FOR SELECT TO authenticated
USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'principal', 'coordinator', 'teacher')
    OR student_id = auth.uid()
);

CREATE POLICY "Recipients UPDATE Policy"
ON public.test_exam_communication_recipients FOR UPDATE TO authenticated
USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR student_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'principal')
);

-- 7.4 Audit Logs: Read-only to staff; INSERT allowed; UPDATE/DELETE blocked.
CREATE POLICY "Audit Logs SELECT Policy"
ON public.test_exam_communication_audit_logs FOR SELECT TO authenticated
USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'principal', 'coordinator')
);

CREATE POLICY "Audit Logs INSERT Policy"
ON public.test_exam_communication_audit_logs FOR INSERT TO authenticated
WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'principal', 'coordinator', 'teacher')
);
