-- Run in Supabase SQL Editor:
-- Adds test_date column to class_subject_mark_submissions for test assessment date tracking

ALTER TABLE IF EXISTS public.class_subject_mark_submissions 
ADD COLUMN IF NOT EXISTS test_date DATE;

CREATE INDEX IF NOT EXISTS idx_submissions_test_date 
ON public.class_subject_mark_submissions(test_date);

COMMENT ON COLUMN public.class_subject_mark_submissions.test_date IS 'Authoritative date when the assessment/weekly test was conducted.';
