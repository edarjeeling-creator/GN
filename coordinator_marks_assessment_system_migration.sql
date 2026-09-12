-- ==============================================================================
-- GYANODAY NIKETAN ERP: COORDINATOR-CONTROLLED MARKS, VERIFICATION, LOCKING,
-- REPORT PRINTING & ADMIN-CONFIGURABLE ASSESSMENT ENGINE MIGRATION
-- ==============================================================================

-- 1. ASSESSMENT PATTERNS TABLE (Admin-Configurable Schemes per Section & Year)
CREATE TABLE IF NOT EXISTS public.assessment_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL DEFAULT '2026',
  pattern_name TEXT NOT NULL,
  class_group TEXT NOT NULL CHECK (class_group IN ('JUNIOR', 'SENIOR_5_8', 'SECONDARY_9_10', 'HIGHER_SECONDARY_11_12', 'CUSTOM')),
  applicable_classes JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of class names e.g. ["Class 5", "Class 6", "Class 7", "Class 8"]
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  rounding_rule TEXT NOT NULL DEFAULT 'ROUND_2_DECIMALS' CHECK (rounding_rule IN ('NO_ROUNDING', 'ROUND_NEAREST_INTEGER', 'ROUND_1_DECIMAL', 'ROUND_2_DECIMALS')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ASSESSMENT COMPONENTS TABLE (Raw max, Converted max, Weights)
CREATE TABLE IF NOT EXISTS public.assessment_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID NOT NULL REFERENCES public.assessment_patterns(id) ON DELETE CASCADE,
  component_code TEXT NOT NULL, -- e.g. 'TEST', 'EXAM', 'PRACTICAL', 'PROJECT', 'INTERNAL'
  component_name TEXT NOT NULL, -- e.g. 'Weekly Test', 'Term Examination'
  raw_max_marks NUMERIC(6, 2) NOT NULL CHECK (raw_max_marks > 0),
  converted_max_marks NUMERIC(6, 2) NOT NULL CHECK (converted_max_marks > 0),
  weightage_percentage NUMERIC(5, 2) DEFAULT 100.00,
  is_mandatory BOOLEAN DEFAULT TRUE,
  contributes_to_total BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 1,
  calculation_rule JSONB DEFAULT '{"formula": "RAW * CONVERTED_MAX / RAW_MAX"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pattern_id, component_code)
);

-- 3. GRADING SCHEMES & BOUNDARIES TABLE
CREATE TABLE IF NOT EXISTS public.grade_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID NOT NULL REFERENCES public.assessment_patterns(id) ON DELETE CASCADE,
  grade_name TEXT NOT NULL, -- e.g. 'A+', 'A', 'B', 'C', 'D', 'F'
  min_percentage NUMERIC(5, 2) NOT NULL CHECK (min_percentage >= 0),
  max_percentage NUMERIC(5, 2) NOT NULL CHECK (max_percentage <= 100 AND max_percentage >= min_percentage),
  grade_point NUMERIC(4, 2),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SUBJECT ASSESSMENT RULES (Special rules: 6th Subject, Additional, Electives)
CREATE TABLE IF NOT EXISTS public.subject_assessment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID NOT NULL REFERENCES public.assessment_patterns(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  subject_code TEXT, -- fallback code or name match
  subject_category TEXT NOT NULL DEFAULT 'MAIN' CHECK (subject_category IN ('MAIN', 'ADDITIONAL', 'SIXTH_SUBJECT', 'PRACTICAL', 'OPTIONAL')),
  include_in_aggregate BOOLEAN DEFAULT TRUE,
  include_in_percentage BOOLEAN DEFAULT TRUE,
  include_in_rank BOOLEAN DEFAULT TRUE,
  pass_marks NUMERIC(6, 2) DEFAULT 40.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CLASS SUBJECT MARK SUBMISSIONS (State Machine for Workflow)
CREATE TABLE IF NOT EXISTS public.class_subject_mark_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL,
  term TEXT NOT NULL, -- e.g. 'Midterm', 'Finalterm'
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pattern_id UUID REFERENCES public.assessment_patterns(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 
    'SUBMITTED', 
    'UNDER_REVIEW', 
    'RETURNED_FOR_CORRECTION', 
    'RESUBMITTED', 
    'APPROVED', 
    'LOCKED'
  )),
  submission_notes TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  return_reason TEXT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  locked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(academic_year, term, class_id, subject_id)
);

-- 6. STUDENT MARKS DETAILED TABLE (Component-level Raw & Converted Scores)
CREATE TABLE IF NOT EXISTS public.student_marks_detailed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.class_subject_mark_submissions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.assessment_components(id) ON DELETE CASCADE,
  raw_score NUMERIC(6, 2),
  converted_score NUMERIC(6, 2),
  status TEXT NOT NULL DEFAULT 'MARKED' CHECK (status IN ('MARKED', 'ABSENT', 'NOT_APPLICABLE')),
  is_override BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  override_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submission_id, student_id, component_id)
);

-- 7. REPORT PRINT LOGS (Permanent History of Official Reports)
CREATE TABLE IF NOT EXISTS public.report_print_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL,
  term TEXT NOT NULL,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  report_version TEXT NOT NULL, -- e.g. 'TERM-I-2026-V1'
  generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  printed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  printed_at TIMESTAMPTZ DEFAULT NOW(),
  student_count INTEGER DEFAULT 0,
  configuration_snapshot JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. MARKS WORKFLOW AUDIT LOGS (Immutable History)
CREATE TABLE IF NOT EXISTS public.marks_workflow_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.class_subject_mark_submissions(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL, -- 'SAVE_DRAFT', 'SUBMIT', 'RETURN', 'RESUBMIT', 'APPROVE', 'LOCK', 'OVERRIDE'
  previous_status TEXT,
  new_status TEXT,
  reason TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. SEED INITIAL ASSESSMENT PATTERNS (Without Hardcoding into Application Code)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  v_p_junior UUID;
  v_p_5_8 UUID;
  v_p_9_10 UUID;
  v_p_11_12 UUID;
BEGIN
  -- A. JUNIOR SCHOOL (Marks + Grading)
  INSERT INTO public.assessment_patterns (academic_year, pattern_name, class_group, applicable_classes, description, rounding_rule, status)
  VALUES ('2026', 'Junior School Assessment Scheme', 'JUNIOR', 
    '["Class 1", "Class 2", "Class 3", "Class 4", "Playgroup", "LKG", "UKG", "Nursery"]'::jsonb,
    'Formative and Summative Marks with Descriptive Grading for Junior Wing', 'ROUND_NEAREST_INTEGER', 'ACTIVE')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_p_junior;

  IF v_p_junior IS NOT NULL THEN
    INSERT INTO public.assessment_components (pattern_id, component_code, component_name, raw_max_marks, converted_max_marks, weightage_percentage, display_order)
    VALUES 
      (v_p_junior, 'TEST', 'Periodic / Formative Test', 25.00, 25.00, 25.00, 1),
      (v_p_junior, 'EXAM', 'Term Examination', 100.00, 75.00, 75.00, 2)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.grade_boundaries (pattern_id, grade_name, min_percentage, max_percentage, description)
    VALUES
      (v_p_junior, 'A+', 90.00, 100.00, 'Outstanding'),
      (v_p_junior, 'A', 80.00, 89.99, 'Excellent'),
      (v_p_junior, 'B+', 70.00, 79.99, 'Very Good'),
      (v_p_junior, 'B', 60.00, 69.99, 'Good'),
      (v_p_junior, 'C', 40.00, 59.99, 'Satisfactory'),
      (v_p_junior, 'D', 0.00, 39.99, 'Needs Improvement')
    ON CONFLICT DO NOTHING;
  END IF;

  -- B. SENIOR SCHOOL CLASSES 5 TO 8 (Test 25 + Exam 100 -> 75, Total 100)
  INSERT INTO public.assessment_patterns (academic_year, pattern_name, class_group, applicable_classes, description, rounding_rule, status)
  VALUES ('2026', 'Senior School (Classes 5-8) Scheme', 'SENIOR_5_8', 
    '["Class 5", "Class 6", "Class 7", "Class 8", "Class 5 A", "Class 5 B", "Class 6 A", "Class 6 B", "Class 7 A", "Class 7 B", "Class 8 A", "Class 8 B"]'::jsonb,
    'Weekly Test (25) + Term Exam (100 Raw -> Converted to 75) = Final Total 100', 'ROUND_2_DECIMALS', 'ACTIVE')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_p_5_8;

  IF v_p_5_8 IS NOT NULL THEN
    INSERT INTO public.assessment_components (pattern_id, component_code, component_name, raw_max_marks, converted_max_marks, weightage_percentage, display_order)
    VALUES 
      (v_p_5_8, 'TEST', 'Weekly Test', 25.00, 25.00, 25.00, 1),
      (v_p_5_8, 'EXAM', 'Term Examination', 100.00, 75.00, 75.00, 2)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.grade_boundaries (pattern_id, grade_name, min_percentage, max_percentage, description)
    VALUES
      (v_p_5_8, 'A*', 90.00, 100.00, 'Distinction'),
      (v_p_5_8, 'A', 80.00, 89.99, 'Excellent'),
      (v_p_5_8, 'B', 70.00, 79.99, 'Very Good'),
      (v_p_5_8, 'C', 60.00, 69.99, 'Good'),
      (v_p_5_8, 'D', 40.00, 59.99, 'Pass'),
      (v_p_5_8, 'E', 0.00, 39.99, 'Failed')
    ON CONFLICT DO NOTHING;
  END IF;

  -- C. SECONDARY SCHOOL CLASSES 9 AND 10 (Separate Configurable Pattern with 6th Subject Rules)
  INSERT INTO public.assessment_patterns (academic_year, pattern_name, class_group, applicable_classes, description, rounding_rule, status)
  VALUES ('2026', 'Secondary School (Classes 9-10) Scheme', 'SECONDARY_9_10', 
    '["Class 9", "Class 10", "Class 9 A", "Class 9 B", "Class 10 A", "Class 10 B"]'::jsonb,
    'Secondary ICSE Board aligned assessment scheme with configurable 6th subject rules', 'ROUND_2_DECIMALS', 'ACTIVE')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_p_9_10;

  IF v_p_9_10 IS NOT NULL THEN
    INSERT INTO public.assessment_components (pattern_id, component_code, component_name, raw_max_marks, converted_max_marks, weightage_percentage, display_order)
    VALUES 
      (v_p_9_10, 'TEST', 'Periodic / Internal Test', 20.00, 20.00, 20.00, 1),
      (v_p_9_10, 'EXAM', 'Term Examination', 100.00, 80.00, 80.00, 2)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.grade_boundaries (pattern_id, grade_name, min_percentage, max_percentage, description)
    VALUES
      (v_p_9_10, 'A', 80.00, 100.00, 'Excellent'),
      (v_p_9_10, 'B', 65.00, 79.99, 'Very Good'),
      (v_p_9_10, 'C', 50.00, 64.99, 'Good'),
      (v_p_9_10, 'D', 35.00, 49.99, 'Pass'),
      (v_p_9_10, 'E', 0.00, 34.99, 'Failed')
    ON CONFLICT DO NOTHING;
  END IF;

  -- D. HIGHER SECONDARY CLASSES 11 AND 12 (Theory + Practical / Projects)
  INSERT INTO public.assessment_patterns (academic_year, pattern_name, class_group, applicable_classes, description, rounding_rule, status)
  VALUES ('2026', 'Higher Secondary (Classes 11-12) Scheme', 'HIGHER_SECONDARY_11_12', 
    '["Class 11", "Class 12", "Class 11 Science", "Class 11 Arts", "Class 12 Science", "Class 12 Arts"]'::jsonb,
    'ISC Senior Secondary Scheme with Theory and Practical/Project Weighting', 'ROUND_2_DECIMALS', 'ACTIVE')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_p_11_12;

  IF v_p_11_12 IS NOT NULL THEN
    INSERT INTO public.assessment_components (pattern_id, component_code, component_name, raw_max_marks, converted_max_marks, weightage_percentage, display_order)
    VALUES 
      (v_p_11_12, 'THEORY', 'Theory Examination', 70.00, 70.00, 70.00, 1),
      (v_p_11_12, 'PRACTICAL', 'Practical / Project Work', 30.00, 30.00, 30.00, 2)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.grade_boundaries (pattern_id, grade_name, min_percentage, max_percentage, description)
    VALUES
      (v_p_11_12, '1', 90.00, 100.00, 'Very Good'),
      (v_p_11_12, '2', 80.00, 89.99, 'Good'),
      (v_p_11_12, '3', 70.00, 79.99, 'Satisfactory'),
      (v_p_11_12, '4', 60.00, 69.99, 'Fair'),
      (v_p_11_12, '5', 50.00, 59.99, 'Pass'),
      (v_p_11_12, '6', 40.00, 49.99, 'Low Pass'),
      (v_p_11_12, '7', 0.00, 39.99, 'Failed')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE public.assessment_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_boundaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_assessment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subject_mark_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_marks_detailed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_print_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks_workflow_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Assessment configuration can be read by all authenticated users
DROP POLICY IF EXISTS "Allow read assessment_patterns" ON public.assessment_patterns;
CREATE POLICY "Allow read assessment_patterns" ON public.assessment_patterns FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read assessment_components" ON public.assessment_components;
CREATE POLICY "Allow read assessment_components" ON public.assessment_components FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read grade_boundaries" ON public.grade_boundaries;
CREATE POLICY "Allow read grade_boundaries" ON public.grade_boundaries FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read subject_assessment_rules" ON public.subject_assessment_rules;
CREATE POLICY "Allow read subject_assessment_rules" ON public.subject_assessment_rules FOR SELECT TO authenticated USING (true);

-- 2. Only Admin and Principal can modify assessment configurations
DROP POLICY IF EXISTS "Allow admin modify assessment_patterns" ON public.assessment_patterns;
CREATE POLICY "Allow admin modify assessment_patterns" ON public.assessment_patterns FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'principal', 'superadmin')));

DROP POLICY IF EXISTS "Allow admin modify assessment_components" ON public.assessment_components;
CREATE POLICY "Allow admin modify assessment_components" ON public.assessment_components FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'principal', 'superadmin')));

DROP POLICY IF EXISTS "Allow admin modify grade_boundaries" ON public.grade_boundaries;
CREATE POLICY "Allow admin modify grade_boundaries" ON public.grade_boundaries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'principal', 'superadmin')));

DROP POLICY IF EXISTS "Allow admin modify subject_assessment_rules" ON public.subject_assessment_rules;
CREATE POLICY "Allow admin modify subject_assessment_rules" ON public.subject_assessment_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'principal', 'superadmin')));

-- 3. Submissions and Marks Detailed Policies
DROP POLICY IF EXISTS "Allow read class_subject_mark_submissions" ON public.class_subject_mark_submissions;
CREATE POLICY "Allow read class_subject_mark_submissions" ON public.class_subject_mark_submissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow teacher insert/update draft submissions" ON public.class_subject_mark_submissions;
CREATE POLICY "Allow teacher insert/update draft submissions" ON public.class_subject_mark_submissions FOR ALL TO authenticated
  USING (
    teacher_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('admin', 'principal', 'superadmin', 'coordinator') OR designation ILIKE '%coordinator%'))
  );

DROP POLICY IF EXISTS "Allow read student_marks_detailed" ON public.student_marks_detailed;
CREATE POLICY "Allow read student_marks_detailed" ON public.student_marks_detailed FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow modify student_marks_detailed" ON public.student_marks_detailed;
CREATE POLICY "Allow modify student_marks_detailed" ON public.student_marks_detailed FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_subject_mark_submissions s
      WHERE s.id = submission_id 
      AND (
        (s.teacher_id = auth.uid() AND s.status IN ('DRAFT', 'RETURNED_FOR_CORRECTION'))
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('admin', 'principal', 'superadmin', 'coordinator') OR designation ILIKE '%coordinator%'))
      )
    )
  );

-- 4. Print logs and Audit logs (Immutable)
DROP POLICY IF EXISTS "Allow read report_print_logs" ON public.report_print_logs;
CREATE POLICY "Allow read report_print_logs" ON public.report_print_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert report_print_logs" ON public.report_print_logs;
CREATE POLICY "Allow insert report_print_logs" ON public.report_print_logs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('admin', 'principal', 'superadmin', 'coordinator') OR designation ILIKE '%coordinator%'))
);

DROP POLICY IF EXISTS "Allow read marks_workflow_audit_logs" ON public.marks_workflow_audit_logs;
CREATE POLICY "Allow read marks_workflow_audit_logs" ON public.marks_workflow_audit_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert marks_workflow_audit_logs" ON public.marks_workflow_audit_logs;
CREATE POLICY "Allow insert marks_workflow_audit_logs" ON public.marks_workflow_audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 11. ATOMIC SERVER-SIDE RPCS (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- RPC 1: SUBMIT CLASS SUBJECT MARKS (Teacher action)
CREATE OR REPLACE FUNCTION public.submit_class_subject_marks(
  p_submission_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_submission RECORD;
  v_incomplete_count INT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_caller_profile FROM public.profiles WHERE id = v_caller_id;
  SELECT * INTO v_submission FROM public.class_subject_mark_submissions WHERE id = p_submission_id;

  IF v_submission.id IS NULL THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_FOUND';
  END IF;

  -- Teacher can only submit their own marksheet, or Admin/Coordinator
  IF v_submission.teacher_id != v_caller_id 
     AND v_caller_profile.role NOT IN ('admin', 'principal', 'superadmin', 'coordinator') 
     AND COALESCE(v_caller_profile.designation, '') NOT ILIKE '%coordinator%' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_SUBMISSION';
  END IF;

  IF v_submission.status NOT IN ('DRAFT', 'RETURNED_FOR_CORRECTION') THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Current status is %', v_submission.status;
  END IF;

  -- Check if any marks exist
  SELECT COUNT(*) INTO v_incomplete_count 
  FROM public.student_marks_detailed 
  WHERE submission_id = p_submission_id AND raw_score IS NOT NULL;

  IF v_incomplete_count = 0 THEN
    RAISE EXCEPTION 'CANNOT_SUBMIT_EMPTY_MARKSHEET: Please enter student marks before submitting.';
  END IF;

  -- Update submission status to SUBMITTED
  UPDATE public.class_subject_mark_submissions
  SET 
    status = CASE WHEN v_submission.status = 'RETURNED_FOR_CORRECTION' THEN 'RESUBMITTED' ELSE 'SUBMITTED' END,
    submission_notes = COALESCE(p_notes, submission_notes),
    submitted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_submission_id;

  -- Insert Audit Log
  INSERT INTO public.marks_workflow_audit_logs (
    submission_id, class_id, subject_id, actor_id, actor_role, action, 
    previous_status, new_status, reason, details
  )
  VALUES (
    p_submission_id, v_submission.class_id, v_submission.subject_id, v_caller_id, v_caller_profile.role,
    CASE WHEN v_submission.status = 'RETURNED_FOR_CORRECTION' THEN 'RESUBMIT' ELSE 'SUBMIT' END,
    v_submission.status, 
    CASE WHEN v_submission.status = 'RETURNED_FOR_CORRECTION' THEN 'RESUBMITTED' ELSE 'SUBMITTED' END,
    p_notes,
    jsonb_build_object('markedStudentsCount', v_incomplete_count)
  );

  -- Keep legacy marks_status synchronized
  INSERT INTO public.marks_status (class_id, term, status, updated_by)
  VALUES (v_submission.class_id, v_submission.academic_year || '_' || v_submission.term || '_Exam', 'Submitted', v_caller_id)
  ON CONFLICT (class_id, term) DO UPDATE SET status = 'Submitted', updated_by = v_caller_id;

  RETURN jsonb_build_object(
    'success', TRUE, 
    'submissionId', p_submission_id, 
    'status', CASE WHEN v_submission.status = 'RETURNED_FOR_CORRECTION' THEN 'RESUBMITTED' ELSE 'SUBMITTED' END
  );
END;
$$;

-- RPC 2: COORDINATOR REVIEW SUBMISSION (Approve, Lock, Return for Correction)
CREATE OR REPLACE FUNCTION public.coordinator_review_submission(
  p_submission_id UUID,
  p_action TEXT, -- 'APPROVE', 'LOCK', 'RETURN_FOR_CORRECTION'
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_submission RECORD;
  v_new_status TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_caller_profile FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_profile.role NOT IN ('admin', 'principal', 'superadmin', 'coordinator') 
     AND COALESCE(v_caller_profile.designation, '') NOT ILIKE '%coordinator%' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_COORDINATOR_ACTION: Only authorized Coordinator or Administration can review/approve marks.';
  END IF;

  SELECT * INTO v_submission FROM public.class_subject_mark_submissions WHERE id = p_submission_id;
  IF v_submission.id IS NULL THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_FOUND';
  END IF;

  IF p_action = 'RETURN_FOR_CORRECTION' THEN
    IF TRIM(COALESCE(p_reason, '')) = '' THEN
      RAISE EXCEPTION 'MANDATORY_REASON_REQUIRED: A specific reason must be provided when returning marks for correction.';
    END IF;
    v_new_status := 'RETURNED_FOR_CORRECTION';

    UPDATE public.class_subject_mark_submissions
    SET 
      status = v_new_status,
      return_reason = p_reason,
      reviewed_by = v_caller_id,
      reviewed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_submission_id;

  ELSIF p_action = 'APPROVE' THEN
    IF v_submission.status NOT IN ('SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW') THEN
      RAISE EXCEPTION 'CANNOT_APPROVE: Submission must be in SUBMITTED or RESUBMITTED status.';
    END IF;
    v_new_status := 'APPROVED';

    UPDATE public.class_subject_mark_submissions
    SET 
      status = v_new_status,
      approved_by = v_caller_id,
      approved_at = NOW(),
      reviewed_by = v_caller_id,
      reviewed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_submission_id;

  ELSIF p_action = 'LOCK' THEN
    IF v_submission.status != 'APPROVED' THEN
      RAISE EXCEPTION 'CANNOT_LOCK: Marks must be APPROVED before they can be locked.';
    END IF;
    v_new_status := 'LOCKED';

    UPDATE public.class_subject_mark_submissions
    SET 
      status = v_new_status,
      locked_by = v_caller_id,
      locked_at = NOW(),
      updated_at = NOW()
    WHERE id = p_submission_id;

  ELSE
    RAISE EXCEPTION 'INVALID_ACTION: Must be APPROVE, LOCK, or RETURN_FOR_CORRECTION.';
  END IF;

  -- Write to immutable workflow audit log
  INSERT INTO public.marks_workflow_audit_logs (
    submission_id, class_id, subject_id, actor_id, actor_role, action, 
    previous_status, new_status, reason
  )
  VALUES (
    p_submission_id, v_submission.class_id, v_submission.subject_id, v_caller_id, v_caller_profile.role,
    p_action, v_submission.status, v_new_status, p_reason
  );

  -- Keep legacy marks_status synchronized
  IF v_new_status IN ('APPROVED', 'LOCKED') THEN
    INSERT INTO public.marks_status (class_id, term, status, updated_by)
    VALUES (v_submission.class_id, v_submission.academic_year || '_' || v_submission.term || '_Exam', v_new_status, v_caller_id)
    ON CONFLICT (class_id, term) DO UPDATE SET status = v_new_status, updated_by = v_caller_id;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'submissionId', p_submission_id,
    'action', p_action,
    'newStatus', v_new_status
  );
END;
$$;

-- RPC 3: VERIFY CLASS REPORT READINESS (Gatekeeper: Fails closed)
CREATE OR REPLACE FUNCTION public.verify_class_report_readiness(
  p_class_id UUID,
  p_academic_year TEXT,
  p_term TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_total_subjects INT;
  v_locked_subjects INT;
  v_unlocked_list JSONB;
  v_is_ready BOOLEAN;
BEGIN
  -- Total assigned subjects for this class
  SELECT COUNT(DISTINCT ts.subject_id) INTO v_total_subjects
  FROM public.teacher_subjects ts
  WHERE ts.class_id = p_class_id;

  -- Locked submissions for this class, academic_year, and term
  SELECT COUNT(DISTINCT s.subject_id) INTO v_locked_subjects
  FROM public.class_subject_mark_submissions s
  WHERE s.class_id = p_class_id 
    AND s.academic_year = p_academic_year 
    AND s.term = p_term 
    AND s.status = 'LOCKED';

  -- Collect details of unlocked or unapproved subjects
  SELECT jsonb_agg(jsonb_build_object(
    'subjectId', sub.id,
    'subjectName', sub.name,
    'status', COALESCE(s.status, 'NOT_STARTED'),
    'teacherId', ts.teacher_id,
    'teacherName', prof.name
  )) INTO v_unlocked_list
  FROM public.teacher_subjects ts
  JOIN public.subjects sub ON sub.id = ts.subject_id
  LEFT JOIN public.profiles prof ON prof.id = ts.teacher_id
  LEFT JOIN public.class_subject_mark_submissions s 
    ON s.class_id = p_class_id 
   AND s.subject_id = ts.subject_id 
   AND s.academic_year = p_academic_year 
   AND s.term = p_term
  WHERE ts.class_id = p_class_id 
    AND (s.status IS NULL OR s.status != 'LOCKED');

  v_is_ready := (v_total_subjects > 0 AND v_locked_subjects >= v_total_subjects);

  RETURN jsonb_build_object(
    'classId', p_class_id,
    'academicYear', p_academic_year,
    'term', p_term,
    'isReady', v_is_ready,
    'totalSubjects', v_total_subjects,
    'lockedSubjects', v_locked_subjects,
    'pendingSubjectsCount', COALESCE(jsonb_array_length(v_unlocked_list), 0),
    'unlockedSubjects', COALESCE(v_unlocked_list, '[]'::jsonb)
  );
END;
$$;

-- RPC 4: PRINCIPAL / ADMIN EXCEPTIONAL OVERRIDE
CREATE OR REPLACE FUNCTION public.principal_override_mark(
  p_detailed_mark_id UUID,
  p_new_raw_score NUMERIC,
  p_new_status TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_mark RECORD;
  v_component RECORD;
  v_new_converted NUMERIC;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_caller_profile FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_profile.role NOT IN ('admin', 'principal', 'superadmin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only Principal or Admin can perform an exceptional marks override.';
  END IF;

  IF TRIM(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED: A valid audit reason is mandatory for exceptional marks override.';
  END IF;

  SELECT * INTO v_mark FROM public.student_marks_detailed WHERE id = p_detailed_mark_id;
  IF v_mark.id IS NULL THEN
    RAISE EXCEPTION 'MARK_RECORD_NOT_FOUND';
  END IF;

  SELECT * INTO v_component FROM public.assessment_components WHERE id = v_mark.component_id;
  
  -- Calculate converted score
  IF p_new_raw_score IS NOT NULL AND v_component.id IS NOT NULL THEN
    IF p_new_raw_score > v_component.raw_max_marks THEN
      RAISE EXCEPTION 'SCORE_EXCEEDS_MAX: % exceeds raw maximum %', p_new_raw_score, v_component.raw_max_marks;
    END IF;
    v_new_converted := ROUND((p_new_raw_score * v_component.converted_max_marks / v_component.raw_max_marks)::numeric, 2);
  ELSE
    v_new_converted := NULL;
  END IF;

  -- Apply override
  UPDATE public.student_marks_detailed
  SET 
    raw_score = p_new_raw_score,
    converted_score = v_new_converted,
    status = COALESCE(p_new_status, status),
    is_override = TRUE,
    override_reason = p_reason,
    override_by = v_caller_id,
    updated_at = NOW()
  WHERE id = p_detailed_mark_id;

  -- Insert into permanent audit log
  INSERT INTO public.marks_workflow_audit_logs (
    submission_id, actor_id, actor_role, action, reason, details
  )
  VALUES (
    v_mark.submission_id, v_caller_id, v_caller_profile.role, 'OVERRIDE', p_reason,
    jsonb_build_object(
      'studentId', v_mark.student_id,
      'componentId', v_mark.component_id,
      'oldRaw', v_mark.raw_score,
      'newRaw', p_new_raw_score,
      'oldConverted', v_mark.converted_score,
      'newConverted', v_new_converted
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'markId', p_detailed_mark_id,
    'newRaw', p_new_raw_score,
    'newConverted', v_new_converted
  );
END;
$$;

-- RPC 5: LOG REPORT PRINT EVENT
CREATE OR REPLACE FUNCTION public.log_report_print_event(
  p_academic_year TEXT,
  p_term TEXT,
  p_class_id UUID,
  p_report_version TEXT,
  p_student_count INT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_log_id UUID;
  v_readiness JSONB;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_caller_profile FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_profile.role NOT IN ('admin', 'principal', 'superadmin', 'coordinator') 
     AND COALESCE(v_caller_profile.designation, '') NOT ILIKE '%coordinator%' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_PRINTING: Only authorized Coordinator or Administration can print official report cards.';
  END IF;

  -- Gating validation: verify class is 100% ready
  v_readiness := public.verify_class_report_readiness(p_class_id, p_academic_year, p_term);
  IF (v_readiness->>'isReady')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'PREMATURE_PRINTING_BLOCKED: Class has % pending unapproved/unlocked subjects. All subjects must be APPROVED and LOCKED by the Coordinator before printing.', 
      v_readiness->>'pendingSubjectsCount';
  END IF;

  INSERT INTO public.report_print_logs (
    academic_year, term, class_id, report_version, generated_by, printed_by, student_count, notes
  )
  VALUES (
    p_academic_year, p_term, p_class_id, p_report_version, v_caller_id, v_caller_id, p_student_count, p_notes
  )
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'logId', v_log_id,
    'reportVersion', p_report_version,
    'printedAt', NOW()
  );
END;
$$;

-- Grant EXECUTE to authenticated users
GRANT EXECUTE ON FUNCTION public.submit_class_subject_marks(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coordinator_review_submission(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_class_report_readiness(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.principal_override_mark(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_report_print_event(TEXT, TEXT, UUID, TEXT, INT, TEXT) TO authenticated;

-- Notify schema reload for PostgREST
NOTIFY pgrst, 'reload schema';
