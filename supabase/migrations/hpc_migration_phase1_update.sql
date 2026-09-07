/* HPC Phase 1 - Update Migration
 * Run this in your Supabase SQL Editor if you already ran the first version.
 * This applies the missing workflow triggers and corrects RLS policies.
 */

-- 1. Correct RLS Policies

-- Assessments
DROP POLICY IF EXISTS "Read assessments" ON public.hpc_student_assessments;
CREATE POLICY "Read assessments" ON public.hpc_student_assessments FOR SELECT TO authenticated 
USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'principal')) OR
  (auth.uid() = student_id AND status = 'published') OR
  (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = class_id)) OR
  (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = hpc_student_assessments.class_id))
);

DROP POLICY IF EXISTS "Update assessments" ON public.hpc_student_assessments;
CREATE POLICY "Update assessments" ON public.hpc_student_assessments FOR UPDATE TO authenticated
USING (
  (
    (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
    (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'principal')) OR
    (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = class_id)) OR
    (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = hpc_student_assessments.class_id))
  )
);

-- Outcome Ratings
DROP POLICY IF EXISTS "Insert outcome ratings" ON public.hpc_outcome_ratings;
CREATE POLICY "Insert outcome ratings" ON public.hpc_outcome_ratings FOR INSERT TO authenticated WITH CHECK (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
  (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id))) OR
  (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id)))
);

DROP POLICY IF EXISTS "Update outcome ratings" ON public.hpc_outcome_ratings;
CREATE POLICY "Update outcome ratings" ON public.hpc_outcome_ratings FOR UPDATE TO authenticated USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'principal')) OR
  (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id))) OR
  (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id)))
);

DROP POLICY IF EXISTS "Delete outcome ratings" ON public.hpc_outcome_ratings;
CREATE POLICY "Delete outcome ratings" ON public.hpc_outcome_ratings FOR DELETE TO authenticated USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
);

-- Competency Ratings
DROP POLICY IF EXISTS "Insert competency ratings" ON public.hpc_competency_ratings;
CREATE POLICY "Insert competency ratings" ON public.hpc_competency_ratings FOR INSERT TO authenticated WITH CHECK (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
  (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id))) OR
  (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id)))
);

DROP POLICY IF EXISTS "Update competency ratings" ON public.hpc_competency_ratings;
CREATE POLICY "Update competency ratings" ON public.hpc_competency_ratings FOR UPDATE TO authenticated USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'principal')) OR
  (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id))) OR
  (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id)))
);

DROP POLICY IF EXISTS "Delete competency ratings" ON public.hpc_competency_ratings;
CREATE POLICY "Delete competency ratings" ON public.hpc_competency_ratings FOR DELETE TO authenticated USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
);

-- 2. TRIGGERS FOR SECURITY AND WORKFLOW

-- A. Prevent modification of published assessments (Database-level immutable lock)
CREATE OR REPLACE FUNCTION public.check_hpc_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'Cannot modify a published assessment.';
    END IF;

    IF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'submitted') THEN
      RAISE EXCEPTION 'Invalid status transition from draft.';
    END IF;

    IF OLD.status = 'submitted' AND NEW.status NOT IN ('submitted', 'under_review', 'draft') THEN
      RAISE EXCEPTION 'Invalid status transition from submitted.';
    END IF;

    IF OLD.status = 'under_review' AND NEW.status NOT IN ('under_review', 'returned', 'approved') THEN
      RAISE EXCEPTION 'Invalid status transition from under_review.';
    END IF;

    IF OLD.status = 'returned' AND NEW.status NOT IN ('returned', 'draft', 'submitted') THEN
      RAISE EXCEPTION 'Invalid status transition from returned.';
    END IF;

    IF OLD.status = 'approved' AND NEW.status NOT IN ('approved', 'published', 'returned') THEN
      RAISE EXCEPTION 'Invalid status transition from approved.';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'Cannot delete a published assessment.';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_hpc_status_transition ON public.hpc_student_assessments;
CREATE TRIGGER enforce_hpc_status_transition
BEFORE UPDATE OR DELETE ON public.hpc_student_assessments
FOR EACH ROW
EXECUTE FUNCTION public.check_hpc_status_transition();

-- B. Prevent modification of ratings linked to a published assessment
CREATE OR REPLACE FUNCTION public.check_hpc_published_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT status INTO v_status FROM public.hpc_student_assessments WHERE id = NEW.assessment_id;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT status INTO v_status FROM public.hpc_student_assessments WHERE id = OLD.assessment_id;
  END IF;

  IF v_status = 'published' THEN
    RAISE EXCEPTION 'Cannot modify ratings of a published assessment.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_published_lock_outcomes ON public.hpc_outcome_ratings;
CREATE TRIGGER enforce_published_lock_outcomes
BEFORE INSERT OR UPDATE OR DELETE ON public.hpc_outcome_ratings
FOR EACH ROW EXECUTE FUNCTION public.check_hpc_published_lock();

DROP TRIGGER IF EXISTS enforce_published_lock_competencies ON public.hpc_competency_ratings;
CREATE TRIGGER enforce_published_lock_competencies
BEFORE INSERT OR UPDATE OR DELETE ON public.hpc_competency_ratings
FOR EACH ROW EXECUTE FUNCTION public.check_hpc_published_lock();

-- C. Automatic Audit Trail Generation
CREATE OR REPLACE FUNCTION public.audit_hpc_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.hpc_audit_logs (entity_type, entity_id, user_id, action, new_value)
    VALUES (TG_TABLE_NAME, NEW.id, auth.uid(), 'CREATE', row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.hpc_audit_logs (entity_type, entity_id, user_id, action, old_value, new_value)
    VALUES (TG_TABLE_NAME, NEW.id, auth.uid(), 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.hpc_audit_logs (entity_type, entity_id, user_id, action, old_value)
    VALUES (TG_TABLE_NAME, OLD.id, auth.uid(), 'DELETE', row_to_json(OLD)::jsonb);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_hpc_student_assessments ON public.hpc_student_assessments;
CREATE TRIGGER audit_hpc_student_assessments
AFTER INSERT OR UPDATE OR DELETE ON public.hpc_student_assessments
FOR EACH ROW EXECUTE FUNCTION public.audit_hpc_changes();

DROP TRIGGER IF EXISTS audit_hpc_outcome_ratings ON public.hpc_outcome_ratings;
CREATE TRIGGER audit_hpc_outcome_ratings
AFTER INSERT OR UPDATE OR DELETE ON public.hpc_outcome_ratings
FOR EACH ROW EXECUTE FUNCTION public.audit_hpc_changes();

DROP TRIGGER IF EXISTS audit_hpc_competency_ratings ON public.hpc_competency_ratings;
CREATE TRIGGER audit_hpc_competency_ratings
AFTER INSERT OR UPDATE OR DELETE ON public.hpc_competency_ratings
FOR EACH ROW EXECUTE FUNCTION public.audit_hpc_changes();
