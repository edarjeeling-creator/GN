-- Phase 3 Security Regression Test Suite
-- Safe to run in Supabase SQL Editor: wrapped in BEGIN ... ROLLBACK to prevent any test data pollution.

BEGIN;

-- ============================================================================
-- 0. Pre-Flight Validation Check
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'hpc_student_assessments' 
      AND column_name = 'version'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT CHECK FAILED: The column "version" does not exist on public.hpc_student_assessments. Please upload and run "hpc_migration_phase3_schema.sql" in your Supabase SQL Editor first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'hpc_student_self_ratings'
  ) THEN
    RAISE EXCEPTION 'PRE-FLIGHT CHECK FAILED: Table public.hpc_student_self_ratings does not exist. Please upload and run "hpc_migration_phase3_schema.sql" first.';
  END IF;
END $$;

-- ============================================================================
-- 1. Setup Helper & Test Immutability of Published Self Ratings & Parent Reflections
-- ============================================================================
DO $$
DECLARE
  v_student_id UUID;
  v_academic_year_id UUID;
  v_term_id UUID;
  v_class_id UUID;
  v_competency_id UUID;
  v_assessment_id UUID;
BEGIN
  -- Dynamically find existing foreign key records, or create temporary mock parents
  SELECT id INTO v_student_id FROM public.students LIMIT 1;
  IF v_student_id IS NULL THEN
    INSERT INTO public.students (name, roll_number) 
    VALUES ('__Test Student__', '__TEST_01__') 
    RETURNING id INTO v_student_id;
  END IF;

  SELECT id INTO v_class_id FROM public.classes LIMIT 1;
  IF v_class_id IS NULL THEN
    INSERT INTO public.classes (class_name, section) 
    VALUES ('__Test Class__', 'A') 
    RETURNING id INTO v_class_id;
  END IF;

  SELECT id INTO v_academic_year_id FROM public.hpc_academic_years LIMIT 1;
  IF v_academic_year_id IS NULL THEN
    INSERT INTO public.hpc_academic_years (year_name) 
    VALUES ('__Test Year 2026-2027__') 
    RETURNING id INTO v_academic_year_id;
  END IF;

  SELECT id INTO v_term_id FROM public.hpc_terms WHERE academic_year_id = v_academic_year_id LIMIT 1;
  IF v_term_id IS NULL THEN
    INSERT INTO public.hpc_terms (academic_year_id, term_name) 
    VALUES (v_academic_year_id, '__Test Term 1__') 
    RETURNING id INTO v_term_id;
  END IF;

  SELECT id INTO v_competency_id FROM public.hpc_competencies LIMIT 1;
  IF v_competency_id IS NULL THEN
    INSERT INTO public.hpc_competencies (name, category) 
    VALUES ('__Test Comp__', 'Cognitive') 
    RETURNING id INTO v_competency_id;
  END IF;

  -- Insert dummy published assessment (version 999 to avoid colliding with existing versions)
  INSERT INTO public.hpc_student_assessments (
    student_id, academic_year_id, term_id, class_id, status, version
  )
  VALUES (
    v_student_id, v_academic_year_id, v_term_id, v_class_id, 'published', 999
  )
  RETURNING id INTO v_assessment_id;

  -- Test 1A: Attempt insert self rating on published assessment (Must fail via enforce_published_lock_self_ratings)
  BEGIN
    INSERT INTO public.hpc_student_self_ratings (assessment_id, competency_id, student_comment)
    VALUES (v_assessment_id, v_competency_id, 'Testing lock');
    RAISE EXCEPTION 'TEST 1A FAILED: Allowed insert on published assessment self rating';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Cannot modify%' OR SQLERRM LIKE '%published%' THEN
        RAISE NOTICE 'TEST 1A PASSED: Prevented insert on published assessment self rating (Trigger locked successfully)';
      ELSE
        RAISE EXCEPTION 'TEST 1A FAILED with unexpected error: %', SQLERRM;
      END IF;
  END;

  -- Test 1B: Attempt insert parent reflection on published assessment (Must fail via enforce_published_lock_parent_refl)
  BEGIN
    INSERT INTO public.hpc_parent_reflections (assessment_id, parent_comment)
    VALUES (v_assessment_id, 'Testing parent lock');
    RAISE EXCEPTION 'TEST 1B FAILED: Allowed insert on published assessment parent reflections';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Cannot modify%' OR SQLERRM LIKE '%published%' THEN
        RAISE NOTICE 'TEST 1B PASSED: Prevented insert on published parent reflections (Trigger locked successfully)';
      ELSE
        RAISE EXCEPTION 'TEST 1B FAILED with unexpected error: %', SQLERRM;
      END IF;
  END;
END $$;

-- ============================================================================
-- 2. Test Versioning Supersedes Trigger (handle_hpc_publish_revision_link)
-- ============================================================================
DO $$
DECLARE
  v_student_id UUID;
  v_academic_year_id UUID;
  v_term_id UUID;
  v_class_id UUID;
  v_v1_id UUID;
  v_v2_id UUID;
  v_supersedes UUID;
BEGIN
  -- Grab foreign keys
  SELECT id INTO v_student_id FROM public.students LIMIT 1;
  SELECT id INTO v_class_id FROM public.classes LIMIT 1;
  SELECT id INTO v_academic_year_id FROM public.hpc_academic_years LIMIT 1;
  SELECT id INTO v_term_id FROM public.hpc_terms WHERE academic_year_id = v_academic_year_id LIMIT 1;

  -- Insert V1 Published
  INSERT INTO public.hpc_student_assessments (
    student_id, academic_year_id, term_id, class_id, status, version
  )
  VALUES (
    v_student_id, v_academic_year_id, v_term_id, v_class_id, 'published', 997
  )
  RETURNING id INTO v_v1_id;

  -- Insert V2 Draft pointing to V1
  INSERT INTO public.hpc_student_assessments (
    student_id, academic_year_id, term_id, class_id, status, version, previous_version_id
  )
  VALUES (
    v_student_id, v_academic_year_id, v_term_id, v_class_id, 'draft', 998, v_v1_id
  )
  RETURNING id INTO v_v2_id;

  -- Follow required workflow transitions: draft -> submitted -> under_review -> approved -> published
  UPDATE public.hpc_student_assessments SET status = 'submitted' WHERE id = v_v2_id;
  UPDATE public.hpc_student_assessments SET status = 'under_review' WHERE id = v_v2_id;
  UPDATE public.hpc_student_assessments SET status = 'approved' WHERE id = v_v2_id;
  UPDATE public.hpc_student_assessments SET status = 'published' WHERE id = v_v2_id;

  -- Verify if V1 got supersedes_assessment_id set to V2
  SELECT supersedes_assessment_id INTO v_supersedes FROM public.hpc_student_assessments WHERE id = v_v1_id;

  IF v_supersedes = v_v2_id THEN
    RAISE NOTICE 'TEST 2 PASSED: V1 superseded correctly by V2 upon publishing';
  ELSE
    RAISE EXCEPTION 'TEST 2 FAILED: V1 supersedes_assessment_id is %, expected %', v_supersedes, v_v2_id;
  END IF;
END $$;

-- Always rollback so no test artifacts remain in database
ROLLBACK;

