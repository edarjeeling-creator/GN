-- fix_class_8_weekly_test_scheme.sql
-- Separates Senior School into Classes 5-7 (Weekly Test 25, Exam 75)
-- and Senior School Class 8 (Weekly Test 20, Exam 80)

DO $$
DECLARE
  v_pat_5_7_id UUID;
  v_pat_8_id UUID;
BEGIN
  -- 1. Update Senior School (Classes 5-7) Scheme
  UPDATE public.assessment_patterns
  SET 
    pattern_name = 'Senior School (Classes 5-7) Scheme',
    applicable_classes = '["Class 5", "Class 6", "Class 7", "Class 5 A", "Class 5 B", "Class 6 A", "Class 6 B", "Class 7 A", "Class 7 B", "5", "6", "7", "5 A", "5 B", "6 A", "6 B", "7 A", "7 B"]'::jsonb,
    description = 'Weekly Test (25) + Term Exam (100 Raw -> Converted to 75) = Final Total 100',
    updated_at = NOW()
  WHERE pattern_name ILIKE '%Classes 5-8%' OR pattern_name ILIKE '%Classes 5-7%';

  -- 2. Create or Update Senior School (Class 8) Scheme
  SELECT id INTO v_pat_8_id 
  FROM public.assessment_patterns 
  WHERE pattern_name ILIKE '%Class 8%' 
  LIMIT 1;

  IF v_pat_8_id IS NULL THEN
    INSERT INTO public.assessment_patterns (
      academic_year, pattern_name, class_group, applicable_classes, description, rounding_rule, status, version
    ) VALUES (
      '2026', 'Senior School (Class 8) Scheme', 'SENIOR_5_8',
      '["Class 8", "Class 8 A", "Class 8 B", "8", "8 A", "8 B"]'::jsonb,
      'Weekly Test (20) + Term Exam (100 Raw -> Converted to 80) = Final Total 100',
      'ROUND_2_DECIMALS', 'ACTIVE', 1
    )
    RETURNING id INTO v_pat_8_id;

    -- Insert Components for Class 8
    INSERT INTO public.assessment_components (
      pattern_id, component_code, component_name, raw_max_marks, converted_max_marks, weightage_percentage, display_order, is_mandatory, contributes_to_total, calculation_rule
    ) VALUES 
      (v_pat_8_id, 'TEST', 'Weekly Test', 20.00, 20.00, 20.00, 1, true, true, '{"formula": "RAW * CONVERTED_MAX / RAW_MAX"}'::jsonb),
      (v_pat_8_id, 'EXAM', 'Term Examination', 100.00, 80.00, 80.00, 2, true, true, '{"formula": "RAW * CONVERTED_MAX / RAW_MAX"}'::jsonb);

    -- Insert Grade Boundaries for Class 8
    INSERT INTO public.grade_boundaries (pattern_id, grade_name, min_percentage, max_percentage, description)
    VALUES
      (v_pat_8_id, 'A*', 90.00, 100.00, 'Distinction'),
      (v_pat_8_id, 'A', 80.00, 89.99, 'Excellent'),
      (v_pat_8_id, 'B', 70.00, 79.99, 'Very Good'),
      (v_pat_8_id, 'C', 60.00, 69.99, 'Good'),
      (v_pat_8_id, 'D', 40.00, 59.99, 'Pass'),
      (v_pat_8_id, 'E', 0.00, 39.99, 'Failed');
  ELSE
    UPDATE public.assessment_patterns
    SET 
      pattern_name = 'Senior School (Class 8) Scheme',
      applicable_classes = '["Class 8", "Class 8 A", "Class 8 B", "8", "8 A", "8 B"]'::jsonb,
      description = 'Weekly Test (20) + Term Exam (100 Raw -> Converted to 80) = Final Total 100',
      status = 'ACTIVE',
      updated_at = NOW()
    WHERE id = v_pat_8_id;
  END IF;

  RAISE NOTICE 'Class 8 Weekly Test (20) assessment scheme migration completed successfully.';
END $$;
