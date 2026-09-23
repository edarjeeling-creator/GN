-- Migration: 20260923_economics_3test_pattern.sql
-- Description: Special 3-Test + Automatic Average Assessment Pattern for Class 9H & 10H Economics only
-- Target Pattern ID: e0190001-0000-4000-a000-000000000001

DO $$
DECLARE
  v_pattern_id UUID := 'e0190001-0000-4000-a000-000000000001';
BEGIN
  -- 1. Insert or update the special Economics 3-Test pattern
  INSERT INTO public.assessment_patterns (
    id,
    academic_year,
    pattern_name,
    class_group,
    applicable_classes,
    description,
    rounding_rule,
    status
  ) VALUES (
    v_pattern_id,
    '2026',
    'Secondary School (Classes 9H & 10H) Economics 3-Test Scheme',
    'SECONDARY_ECONOMICS_3TEST',
    '["Class 9 H", "Class 10 H", "9 H", "10 H", "9H", "10H"]'::jsonb,
    'Special 3-Test Economics assessment with automated average for Classes 9H and 10H',
    'ROUND_2_DECIMALS',
    'ACTIVE'
  )
  ON CONFLICT (id) DO UPDATE SET
    pattern_name = EXCLUDED.pattern_name,
    class_group = EXCLUDED.class_group,
    applicable_classes = EXCLUDED.applicable_classes,
    description = EXCLUDED.description,
    rounding_rule = EXCLUDED.rounding_rule,
    status = EXCLUDED.status;

  -- 2. Insert or update the 4 components:
  -- TEST_1 (Test 1, raw_max: 20, converted_max: 20, contributes_to_total: false)
  INSERT INTO public.assessment_components (
    id, pattern_id, component_code, component_name,
    raw_max_marks, converted_max_marks, weightage_percentage,
    is_mandatory, contributes_to_total, display_order, calculation_rule
  ) VALUES (
    'e0190001-0000-4000-a000-000000000002',
    v_pattern_id,
    'TEST_1',
    'Test 1',
    20.00, 20.00, 20.00,
    true, false, 1,
    '{"is_calculated": false}'::jsonb
  )
  ON CONFLICT (pattern_id, component_code) DO UPDATE SET
    component_name = EXCLUDED.component_name,
    raw_max_marks = EXCLUDED.raw_max_marks,
    converted_max_marks = EXCLUDED.converted_max_marks,
    contributes_to_total = EXCLUDED.contributes_to_total,
    display_order = EXCLUDED.display_order,
    calculation_rule = EXCLUDED.calculation_rule;

  -- TEST_2 (Test 2, raw_max: 20, converted_max: 20, contributes_to_total: false)
  INSERT INTO public.assessment_components (
    id, pattern_id, component_code, component_name,
    raw_max_marks, converted_max_marks, weightage_percentage,
    is_mandatory, contributes_to_total, display_order, calculation_rule
  ) VALUES (
    'e0190001-0000-4000-a000-000000000003',
    v_pattern_id,
    'TEST_2',
    'Test 2',
    20.00, 20.00, 20.00,
    true, false, 2,
    '{"is_calculated": false}'::jsonb
  )
  ON CONFLICT (pattern_id, component_code) DO UPDATE SET
    component_name = EXCLUDED.component_name,
    raw_max_marks = EXCLUDED.raw_max_marks,
    converted_max_marks = EXCLUDED.converted_max_marks,
    contributes_to_total = EXCLUDED.contributes_to_total,
    display_order = EXCLUDED.display_order,
    calculation_rule = EXCLUDED.calculation_rule;

  -- TEST_3 (Test 3, raw_max: 20, converted_max: 20, contributes_to_total: false)
  INSERT INTO public.assessment_components (
    id, pattern_id, component_code, component_name,
    raw_max_marks, converted_max_marks, weightage_percentage,
    is_mandatory, contributes_to_total, display_order, calculation_rule
  ) VALUES (
    'e0190001-0000-4000-a000-000000000004',
    v_pattern_id,
    'TEST_3',
    'Test 3',
    20.00, 20.00, 20.00,
    true, false, 3,
    '{"is_calculated": false}'::jsonb
  )
  ON CONFLICT (pattern_id, component_code) DO UPDATE SET
    component_name = EXCLUDED.component_name,
    raw_max_marks = EXCLUDED.raw_max_marks,
    converted_max_marks = EXCLUDED.converted_max_marks,
    contributes_to_total = EXCLUDED.contributes_to_total,
    display_order = EXCLUDED.display_order,
    calculation_rule = EXCLUDED.calculation_rule;

  -- TEST_AVG (Automatic Average, raw_max: 20, converted_max: 20, contributes_to_total: true, is_calculated: true)
  INSERT INTO public.assessment_components (
    id, pattern_id, component_code, component_name,
    raw_max_marks, converted_max_marks, weightage_percentage,
    is_mandatory, contributes_to_total, display_order, calculation_rule
  ) VALUES (
    'e0190001-0000-4000-a000-000000000005',
    v_pattern_id,
    'TEST_AVG',
    'Average',
    20.00, 20.00, 100.00,
    true, true, 4,
    '{"is_calculated": true, "formula": "AVERAGE(TEST_1, TEST_2, TEST_3)"}'::jsonb
  )
  ON CONFLICT (pattern_id, component_code) DO UPDATE SET
    component_name = EXCLUDED.component_name,
    raw_max_marks = EXCLUDED.raw_max_marks,
    converted_max_marks = EXCLUDED.converted_max_marks,
    contributes_to_total = EXCLUDED.contributes_to_total,
    display_order = EXCLUDED.display_order,
    calculation_rule = EXCLUDED.calculation_rule;

  -- 3. Grade boundaries
  INSERT INTO public.grade_boundaries (pattern_id, grade_name, min_percentage, max_percentage, description)
  VALUES
    (v_pattern_id, 'A', 80.00, 100.00, 'Excellent'),
    (v_pattern_id, 'B', 65.00, 79.99, 'Very Good'),
    (v_pattern_id, 'C', 50.00, 64.99, 'Good'),
    (v_pattern_id, 'D', 35.00, 49.99, 'Pass'),
    (v_pattern_id, 'E', 0.00, 34.99, 'Failed')
  ON CONFLICT DO NOTHING;

END $$;
