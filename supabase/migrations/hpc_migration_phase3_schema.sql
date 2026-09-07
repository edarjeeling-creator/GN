-- Phase 3 Schema

-- 1. hpc_domains
CREATE TABLE IF NOT EXISTS public.hpc_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID NOT NULL REFERENCES public.hpc_frameworks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hpc_domains_framework_id ON public.hpc_domains(framework_id);
CREATE INDEX IF NOT EXISTS idx_hpc_domains_is_active ON public.hpc_domains(is_active);

-- 2. hpc_domain_competencies
CREATE TABLE IF NOT EXISTS public.hpc_domain_competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES public.hpc_domains(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES public.hpc_competencies(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(domain_id, competency_id)
);

-- 3. hpc_indicators
CREATE TABLE IF NOT EXISTS public.hpc_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id UUID NOT NULL REFERENCES public.hpc_competencies(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. hpc_student_self_ratings
CREATE TABLE IF NOT EXISTS public.hpc_student_self_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.hpc_student_assessments(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES public.hpc_competencies(id) ON DELETE CASCADE,
  rating_scale_level_id UUID REFERENCES public.hpc_rating_scale_levels(id) ON DELETE SET NULL,
  student_comment TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assessment_id, competency_id)
);

-- 5. hpc_parent_reflections
CREATE TABLE IF NOT EXISTS public.hpc_parent_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.hpc_student_assessments(id) ON DELETE CASCADE,
  strength_observed TEXT,
  area_requiring_support TEXT,
  interest_talent TEXT,
  parent_comment TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assessment_id)
);

-- 6. hpc_portfolio_evidence
CREATE TABLE IF NOT EXISTS public.hpc_portfolio_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_rating_id UUID NOT NULL REFERENCES public.hpc_competency_ratings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  evidence_type TEXT,
  storage_path TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Assessment Versioning additions
ALTER TABLE public.hpc_student_assessments
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES public.hpc_student_assessments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS supersedes_assessment_id UUID REFERENCES public.hpc_student_assessments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS revision_reason TEXT,
ADD COLUMN IF NOT EXISTS revision_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS revision_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS framework_snapshot JSONB;

-- Backfill existing Phase 2 records
UPDATE public.hpc_student_assessments SET version = 1 WHERE version IS NULL;

-- Dynamic constraint replacement for UNIQUE(student_id, academic_year_id, term_id) -> UNIQUE(..., version)
DO $$ 
DECLARE 
  v_old_constraint text;
BEGIN
  SELECT tc.constraint_name INTO v_old_constraint
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'hpc_student_assessments'
    AND tc.constraint_type = 'UNIQUE'
    AND kcu.column_name IN ('student_id', 'academic_year_id', 'term_id')
  GROUP BY tc.constraint_name
  HAVING COUNT(kcu.column_name) = 3;

  IF v_old_constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.hpc_student_assessments DROP CONSTRAINT IF EXISTS ' || quote_ident(v_old_constraint);
  END IF;
  
  -- Add new constraint safely
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc2
    WHERE tc2.table_schema = 'public'
      AND tc2.table_name = 'hpc_student_assessments'
      AND tc2.constraint_type = 'UNIQUE' 
      AND tc2.constraint_name = 'hpc_student_assessments_student_year_term_version_key'
  ) THEN
    ALTER TABLE public.hpc_student_assessments ADD CONSTRAINT hpc_student_assessments_student_year_term_version_key UNIQUE (student_id, academic_year_id, term_id, version);
  END IF;
END $$;

-- Add new indexes
CREATE INDEX IF NOT EXISTS idx_hpc_assessments_s_a_t ON public.hpc_student_assessments(student_id, academic_year_id, term_id);
CREATE INDEX IF NOT EXISTS idx_hpc_assessments_prev_ver ON public.hpc_student_assessments(previous_version_id);
CREATE INDEX IF NOT EXISTS idx_hpc_assessments_supersedes ON public.hpc_student_assessments(supersedes_assessment_id);
CREATE INDEX IF NOT EXISTS idx_hpc_assessments_status ON public.hpc_student_assessments(status);
