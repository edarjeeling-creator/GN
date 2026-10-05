-- ==============================================================================
-- GYANODAY NIKETAN ERP: EXPANDABLE MULTIPLE-TEST / TEST ATTEMPT SYSTEM MIGRATION
-- ==============================================================================

-- 1. Extend assessment_components to support multiple attempts configuration
ALTER TABLE public.assessment_components 
ADD COLUMN IF NOT EXISTS allow_multiple_attempts BOOLEAN DEFAULT FALSE;

ALTER TABLE public.assessment_components 
ADD COLUMN IF NOT EXISTS aggregation_method TEXT DEFAULT 'AVERAGE';

ALTER TABLE public.assessment_components 
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT NULL;

-- Enable multiple attempts by default for Weekly Test ('TEST') components
UPDATE public.assessment_components 
SET allow_multiple_attempts = TRUE, aggregation_method = 'AVERAGE' 
WHERE component_code = 'TEST';

-- 2. Create assessment_attempts table
CREATE TABLE IF NOT EXISTS public.assessment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.class_subject_mark_submissions(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES public.assessment_components(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
    attempt_name TEXT NOT NULL DEFAULT 'Test 1',
    test_date DATE,
    raw_max_marks NUMERIC(6, 2) NOT NULL CHECK (raw_max_marks > 0),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED', 'DELETED')),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, component_id, attempt_number)
);

-- 3. Create student_attempt_marks table
CREATE TABLE IF NOT EXISTS public.student_attempt_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    score NUMERIC(6, 2) CHECK (score >= 0),
    status TEXT NOT NULL DEFAULT 'MARKED' CHECK (status IN ('MARKED', 'ABSENT', 'NOT_APPLICABLE')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(attempt_id, student_id)
);

-- 4. Indexes for high-performance batch lookups (prevents N+1 query patterns)
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_sub_comp 
ON public.assessment_attempts (submission_id, component_id);

CREATE INDEX IF NOT EXISTS idx_student_attempt_marks_attempt 
ON public.student_attempt_marks (attempt_id, student_id);

CREATE INDEX IF NOT EXISTS idx_student_attempt_marks_student 
ON public.student_attempt_marks (student_id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attempt_marks ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: assessment_attempts
DROP POLICY IF EXISTS "Allow authenticated read assessment_attempts" ON public.assessment_attempts;
CREATE POLICY "Allow authenticated read assessment_attempts" 
ON public.assessment_attempts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow modify assessment_attempts" ON public.assessment_attempts;
CREATE POLICY "Allow modify assessment_attempts" 
ON public.assessment_attempts FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.class_subject_mark_submissions s
        WHERE s.id = submission_id 
        AND (
            (s.teacher_id = auth.uid() AND s.status IN ('DRAFT', 'RETURNED_FOR_CORRECTION'))
            OR EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                AND (role IN ('admin', 'principal', 'superadmin', 'coordinator') OR designation ILIKE '%coordinator%')
            )
        )
    )
);

-- 7. RLS Policies: student_attempt_marks
DROP POLICY IF EXISTS "Allow authenticated read student_attempt_marks" ON public.student_attempt_marks;
CREATE POLICY "Allow authenticated read student_attempt_marks" 
ON public.student_attempt_marks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow modify student_attempt_marks" ON public.student_attempt_marks;
CREATE POLICY "Allow modify student_attempt_marks" 
ON public.student_attempt_marks FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.assessment_attempts a
        JOIN public.class_subject_mark_submissions s ON s.id = a.submission_id
        WHERE a.id = attempt_id
        AND (
            (s.teacher_id = auth.uid() AND s.status IN ('DRAFT', 'RETURNED_FOR_CORRECTION'))
            OR EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() 
                AND (role IN ('admin', 'principal', 'superadmin', 'coordinator') OR designation ILIKE '%coordinator%')
            )
        )
    )
);

-- 8. Backfill Test 1 from existing student_marks_detailed for historical records
DO $$
DECLARE
    sub_rec RECORD;
    v_attempt_id UUID;
BEGIN
    FOR sub_rec IN 
        SELECT DISTINCT s.id AS submission_id, d.component_id, c.raw_max_marks, s.teacher_id, s.test_date
        FROM public.class_subject_mark_submissions s
        JOIN public.student_marks_detailed d ON d.submission_id = s.id
        JOIN public.assessment_components c ON c.id = d.component_id
        WHERE c.component_code = 'TEST'
    LOOP
        -- Check if attempt 1 already exists
        SELECT id INTO v_attempt_id 
        FROM public.assessment_attempts 
        WHERE submission_id = sub_rec.submission_id 
          AND component_id = sub_rec.component_id 
          AND attempt_number = 1;

        IF v_attempt_id IS NULL THEN
            INSERT INTO public.assessment_attempts (
                submission_id, component_id, attempt_number, attempt_name, test_date, raw_max_marks, created_by
            ) VALUES (
                sub_rec.submission_id, sub_rec.component_id, 1, 'Test 1', sub_rec.test_date, sub_rec.raw_max_marks, sub_rec.teacher_id
            ) RETURNING id INTO v_attempt_id;

            -- Migrate marks from student_marks_detailed to student_attempt_marks
            INSERT INTO public.student_attempt_marks (attempt_id, student_id, score, status)
            SELECT v_attempt_id, d.student_id, d.raw_score, d.status
            FROM public.student_marks_detailed d
            WHERE d.submission_id = sub_rec.submission_id 
              AND d.component_id = sub_rec.component_id
            ON CONFLICT (attempt_id, student_id) DO NOTHING;
        END IF;
    END LOOP;
END $$;
