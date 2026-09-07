-- Phase 3 Security & RLS

-- 1. Enable RLS
ALTER TABLE public.hpc_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_domain_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_student_self_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_parent_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_portfolio_evidence ENABLE ROW LEVEL SECURITY;

-- 2. Domain / Config Policies
CREATE POLICY "Allow read config domains" ON public.hpc_domains FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage domains" ON public.hpc_domains FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

CREATE POLICY "Allow read config domain_comps" ON public.hpc_domain_competencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage domain_comps" ON public.hpc_domain_competencies FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

CREATE POLICY "Allow read config indicators" ON public.hpc_indicators FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage indicators" ON public.hpc_indicators FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- 3. Student Self Ratings
CREATE POLICY "Read student_self_ratings" ON public.hpc_student_self_ratings FOR SELECT TO authenticated USING (true);
-- No direct INSERT/UPDATE policies for students, as they use RPC.
-- Teachers/Admins shouldn't insert these directly either.

-- 4. Parent Reflections
CREATE POLICY "Read parent_reflections" ON public.hpc_parent_reflections FOR SELECT TO authenticated USING (true);
-- Submission disabled. No INSERT/UPDATE allowed for now.

-- 5. Portfolio Evidence
CREATE POLICY "Read portfolio_evidence" ON public.hpc_portfolio_evidence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert portfolio_evidence" ON public.hpc_portfolio_evidence FOR INSERT TO authenticated WITH CHECK (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
  (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = (SELECT assessment_id FROM public.hpc_competency_ratings WHERE id = competency_rating_id)))) OR
  (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = (SELECT assessment_id FROM public.hpc_competency_ratings WHERE id = competency_rating_id))))
);
CREATE POLICY "Update portfolio_evidence" ON public.hpc_portfolio_evidence FOR UPDATE TO authenticated USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'principal')) OR
  (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = (SELECT assessment_id FROM public.hpc_competency_ratings WHERE id = competency_rating_id)))) OR
  (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = (SELECT assessment_id FROM public.hpc_competency_ratings WHERE id = competency_rating_id))))
);
CREATE POLICY "Delete portfolio_evidence" ON public.hpc_portfolio_evidence FOR DELETE TO authenticated USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
);

-- 6. Apply Published Locks to New Tables
-- We reuse the existing public.check_hpc_published_lock() for self_ratings and parent_reflections
-- But for portfolio_evidence, it references competency_rating_id, not assessment_id directly.
CREATE OR REPLACE FUNCTION public.check_hpc_published_lock_evidence()
RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT a.status INTO v_status 
    FROM public.hpc_student_assessments a
    JOIN public.hpc_competency_ratings r ON r.assessment_id = a.id
    WHERE r.id = NEW.competency_rating_id;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT a.status INTO v_status 
    FROM public.hpc_student_assessments a
    JOIN public.hpc_competency_ratings r ON r.assessment_id = a.id
    WHERE r.id = OLD.competency_rating_id;
  END IF;

  IF v_status = 'published' THEN
    RAISE EXCEPTION 'Cannot modify evidence of a published assessment.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_published_lock_self_ratings ON public.hpc_student_self_ratings;
CREATE TRIGGER enforce_published_lock_self_ratings
BEFORE INSERT OR UPDATE OR DELETE ON public.hpc_student_self_ratings
FOR EACH ROW EXECUTE FUNCTION public.check_hpc_published_lock();

DROP TRIGGER IF EXISTS enforce_published_lock_parent_refl ON public.hpc_parent_reflections;
CREATE TRIGGER enforce_published_lock_parent_refl
BEFORE INSERT OR UPDATE OR DELETE ON public.hpc_parent_reflections
FOR EACH ROW EXECUTE FUNCTION public.check_hpc_published_lock();

DROP TRIGGER IF EXISTS enforce_published_lock_evidence ON public.hpc_portfolio_evidence;
CREATE TRIGGER enforce_published_lock_evidence
BEFORE INSERT OR UPDATE OR DELETE ON public.hpc_portfolio_evidence
FOR EACH ROW EXECUTE FUNCTION public.check_hpc_published_lock_evidence();

-- 7. Add Audit Triggers to New Tables
DROP TRIGGER IF EXISTS audit_hpc_student_self_ratings ON public.hpc_student_self_ratings;
CREATE TRIGGER audit_hpc_student_self_ratings
AFTER INSERT OR UPDATE OR DELETE ON public.hpc_student_self_ratings
FOR EACH ROW EXECUTE FUNCTION public.audit_hpc_changes();

DROP TRIGGER IF EXISTS audit_hpc_parent_reflections ON public.hpc_parent_reflections;
CREATE TRIGGER audit_hpc_parent_reflections
AFTER INSERT OR UPDATE OR DELETE ON public.hpc_parent_reflections
FOR EACH ROW EXECUTE FUNCTION public.audit_hpc_changes();

DROP TRIGGER IF EXISTS audit_hpc_portfolio_evidence ON public.hpc_portfolio_evidence;
CREATE TRIGGER audit_hpc_portfolio_evidence
AFTER INSERT OR UPDATE OR DELETE ON public.hpc_portfolio_evidence
FOR EACH ROW EXECUTE FUNCTION public.audit_hpc_changes();

-- 8. Trigger to Handle V1 -> V2 supersedes linkage on Publish
CREATE OR REPLACE FUNCTION public.handle_hpc_publish_revision_link()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status != 'published' AND NEW.previous_version_id IS NOT NULL THEN
    -- Update the old version to point to this new version as superseding
    UPDATE public.hpc_student_assessments 
    SET supersedes_assessment_id = NEW.id 
    WHERE id = NEW.previous_version_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_handle_hpc_publish_revision_link ON public.hpc_student_assessments;
CREATE TRIGGER trigger_handle_hpc_publish_revision_link
AFTER UPDATE ON public.hpc_student_assessments
FOR EACH ROW EXECUTE FUNCTION public.handle_hpc_publish_revision_link();
