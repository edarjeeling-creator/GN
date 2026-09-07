-- HPC Phase 1 Migration

-- 1. Configuration Tables
CREATE TABLE public.hpc_academic_years (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year_name TEXT NOT NULL UNIQUE,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE public.hpc_terms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year_id UUID REFERENCES public.hpc_academic_years(id) ON DELETE CASCADE,
  term_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(academic_year_id, term_name)
);

CREATE TABLE public.hpc_rating_scale_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.hpc_rating_scale_levels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scale_set_id UUID REFERENCES public.hpc_rating_scale_sets(id) ON DELETE CASCADE,
  level_name TEXT NOT NULL,
  description TEXT,
  numeric_value INTEGER,
  display_order INTEGER NOT NULL,
  color_code TEXT,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE public.hpc_competencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.hpc_learning_outcomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  competency_id UUID REFERENCES public.hpc_competencies(id) ON DELETE SET NULL,
  outcome_code TEXT,
  outcome_text TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Framework Tables
CREATE TABLE public.hpc_frameworks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  academic_year_id UUID REFERENCES public.hpc_academic_years(id) ON DELETE CASCADE,
  applicable_class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.hpc_framework_competencies (
  framework_id UUID REFERENCES public.hpc_frameworks(id) ON DELETE CASCADE,
  competency_id UUID REFERENCES public.hpc_competencies(id) ON DELETE CASCADE,
  PRIMARY KEY (framework_id, competency_id)
);

CREATE TABLE public.hpc_framework_learning_outcomes (
  framework_id UUID REFERENCES public.hpc_frameworks(id) ON DELETE CASCADE,
  learning_outcome_id UUID REFERENCES public.hpc_learning_outcomes(id) ON DELETE CASCADE,
  PRIMARY KEY (framework_id, learning_outcome_id)
);

CREATE TABLE public.hpc_framework_rating_scales (
  framework_id UUID REFERENCES public.hpc_frameworks(id) ON DELETE CASCADE,
  scale_set_id UUID REFERENCES public.hpc_rating_scale_sets(id) ON DELETE CASCADE,
  PRIMARY KEY (framework_id, scale_set_id)
);

-- 3. Student Assessment Tables
CREATE TABLE public.hpc_student_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.hpc_academic_years(id) ON DELETE CASCADE,
  term_id UUID REFERENCES public.hpc_terms(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'under_review', 'returned', 'approved', 'published')),
  overall_comment TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, academic_year_id, term_id)
);

CREATE TABLE public.hpc_outcome_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID REFERENCES public.hpc_student_assessments(id) ON DELETE CASCADE,
  learning_outcome_id UUID REFERENCES public.hpc_learning_outcomes(id) ON DELETE CASCADE,
  rating_scale_level_id UUID REFERENCES public.hpc_rating_scale_levels(id) ON DELETE SET NULL,
  teacher_comment TEXT,
  assessed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assessment_id, learning_outcome_id)
);

CREATE TABLE public.hpc_competency_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID REFERENCES public.hpc_student_assessments(id) ON DELETE CASCADE,
  competency_id UUID REFERENCES public.hpc_competencies(id) ON DELETE CASCADE,
  rating_scale_level_id UUID REFERENCES public.hpc_rating_scale_levels(id) ON DELETE SET NULL,
  teacher_comment TEXT,
  assessed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assessment_id, competency_id)
);

-- 4. Audit Table
CREATE TABLE public.hpc_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
-- Enable RLS for all new tables
ALTER TABLE public.hpc_academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_rating_scale_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_rating_scale_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_learning_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_framework_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_framework_learning_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_framework_rating_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_student_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_outcome_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_competency_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpc_audit_logs ENABLE ROW LEVEL SECURITY;

-- Base Policies (Read access for authenticated users for configuration)
CREATE POLICY "Allow read config" ON public.hpc_academic_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read config" ON public.hpc_terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read config" ON public.hpc_rating_scale_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read config" ON public.hpc_rating_scale_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read config" ON public.hpc_competencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read config" ON public.hpc_learning_outcomes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read config" ON public.hpc_frameworks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read config" ON public.hpc_framework_competencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read config" ON public.hpc_framework_learning_outcomes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read config" ON public.hpc_framework_rating_scales FOR SELECT TO authenticated USING (true);

-- Admin Config Policies (Insert/Update/Delete)
CREATE POLICY "Admin manage academic_years" ON public.hpc_academic_years FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
CREATE POLICY "Admin manage terms" ON public.hpc_terms FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
CREATE POLICY "Admin manage scale_sets" ON public.hpc_rating_scale_sets FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
CREATE POLICY "Admin manage scale_levels" ON public.hpc_rating_scale_levels FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
CREATE POLICY "Admin manage competencies" ON public.hpc_competencies FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
CREATE POLICY "Admin manage learning_outcomes" ON public.hpc_learning_outcomes FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
CREATE POLICY "Admin manage frameworks" ON public.hpc_frameworks FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
CREATE POLICY "Admin manage framework_competencies" ON public.hpc_framework_competencies FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
CREATE POLICY "Admin manage framework_learning_outcomes" ON public.hpc_framework_learning_outcomes FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
CREATE POLICY "Admin manage framework_rating_scales" ON public.hpc_framework_rating_scales FOR ALL TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- Assessment Policies
CREATE POLICY "Read assessments" ON public.hpc_student_assessments FOR SELECT TO authenticated 
USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'principal')) OR
  (auth.uid() = student_id AND status = 'published') OR
  (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = class_id)) OR
  (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = hpc_student_assessments.class_id))
);

CREATE POLICY "Insert assessments" ON public.hpc_student_assessments FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
  (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = class_id)) OR
  (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = hpc_student_assessments.class_id))
);

CREATE POLICY "Update assessments" ON public.hpc_student_assessments FOR UPDATE TO authenticated
USING (
  (
    (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
    (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'principal')) OR
    (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = class_id)) OR
    (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = hpc_student_assessments.class_id))
  )
);

CREATE POLICY "Delete assessments" ON public.hpc_student_assessments FOR DELETE TO authenticated
USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
);

-- Ratings Policies
CREATE POLICY "Read outcome ratings" ON public.hpc_outcome_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert outcome ratings" ON public.hpc_outcome_ratings FOR INSERT TO authenticated WITH CHECK (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
  (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id))) OR
  (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id)))
);
CREATE POLICY "Update outcome ratings" ON public.hpc_outcome_ratings FOR UPDATE TO authenticated USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'principal')) OR
  (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id))) OR
  (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id)))
);
CREATE POLICY "Delete outcome ratings" ON public.hpc_outcome_ratings FOR DELETE TO authenticated USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
);

CREATE POLICY "Read competency ratings" ON public.hpc_competency_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert competency ratings" ON public.hpc_competency_ratings FOR INSERT TO authenticated WITH CHECK (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
  (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id))) OR
  (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id)))
);
CREATE POLICY "Update competency ratings" ON public.hpc_competency_ratings FOR UPDATE TO authenticated USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'principal')) OR
  (auth.uid() IN (SELECT class_teacher_id FROM public.classes WHERE id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id))) OR
  (auth.uid() IN (SELECT teacher_id FROM public.teacher_subjects WHERE class_id = (SELECT class_id FROM public.hpc_student_assessments WHERE id = assessment_id)))
);
CREATE POLICY "Delete competency ratings" ON public.hpc_competency_ratings FOR DELETE TO authenticated USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
);

-- Audit logs Policies
CREATE POLICY "Insert audit log" ON public.hpc_audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Read audit log" ON public.hpc_audit_logs FOR SELECT TO authenticated USING (
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) OR
  (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'principal'))
);

-- TRIGGERS FOR SECURITY AND WORKFLOW

-- A. Prevent modification of published assessments (Database-level immutable lock)
CREATE OR REPLACE FUNCTION public.check_hpc_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'published' AND NEW.status != 'draft' AND auth.uid() NOT IN (SELECT id FROM public.profiles WHERE role = 'admin') THEN
      RAISE EXCEPTION 'Cannot modify a published assessment unless returning to draft as an admin.';
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

  IF v_status = 'published' AND auth.uid() NOT IN (SELECT id FROM public.profiles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Cannot modify ratings of a published assessment.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_published_lock_outcomes
BEFORE INSERT OR UPDATE OR DELETE ON public.hpc_outcome_ratings
FOR EACH ROW EXECUTE FUNCTION public.check_hpc_published_lock();

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

CREATE TRIGGER audit_hpc_student_assessments
AFTER INSERT OR UPDATE OR DELETE ON public.hpc_student_assessments
FOR EACH ROW EXECUTE FUNCTION public.audit_hpc_changes();

CREATE TRIGGER audit_hpc_outcome_ratings
AFTER INSERT OR UPDATE OR DELETE ON public.hpc_outcome_ratings
FOR EACH ROW EXECUTE FUNCTION public.audit_hpc_changes();

CREATE TRIGGER audit_hpc_competency_ratings
AFTER INSERT OR UPDATE OR DELETE ON public.hpc_competency_ratings
FOR EACH ROW EXECUTE FUNCTION public.audit_hpc_changes();


-- 5. Seed default 4-Level Development Scale
DO $$
DECLARE
  v_scale_set_id UUID;
BEGIN
  INSERT INTO public.hpc_rating_scale_sets (name, description)
  VALUES ('4-Level Development Scale', 'Default assessment scale for NEP 2020 HPC')
  RETURNING id INTO v_scale_set_id;
  
  INSERT INTO public.hpc_rating_scale_levels (scale_set_id, level_name, description, numeric_value, display_order, color_code)
  VALUES
    (v_scale_set_id, 'Advanced', 'Consistently demonstrates the competency independently and confidently.', 4, 1, '#10B981'),
    (v_scale_set_id, 'Proficient', 'Demonstrates the competency appropriately and consistently.', 3, 2, '#3B82F6'),
    (v_scale_set_id, 'Developing', 'Demonstrates the competency with some support.', 2, 3, '#F59E0B'),
    (v_scale_set_id, 'Beginning', 'Requires significant support and further development.', 1, 4, '#EF4444');
END $$;
