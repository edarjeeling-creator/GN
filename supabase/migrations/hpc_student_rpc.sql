CREATE OR REPLACE FUNCTION public.get_student_hpc_report(p_uid TEXT, p_academic_year TEXT, p_term TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student RECORD;
  v_assessment RECORD;
  v_mapped_term TEXT;
  v_marks_term TEXT;
  v_competencies JSONB;
  v_outcomes JSONB;
  v_marks JSONB;
BEGIN
  -- 1. Identity Resolution
  -- The existing ERP architecture relies on 'uid' (admission number) as the primary 
  -- server-side credential for anonymous student queries.
  SELECT * INTO v_student FROM public.students WHERE uid = p_uid;
  IF NOT FOUND THEN 
    RETURN NULL; 
  END IF;

  -- 2. Term Mapping
  -- Centralized server-side mapping mirroring src/utils/hpcMapping.js
  v_mapped_term := CASE
    WHEN p_term = 'Term 1' THEN 'Midterm_Exam'
    WHEN p_term = 'Term 2' THEN 'Final_Exam'
    WHEN p_term = 'Midterm' THEN 'Midterm_Exam'
    WHEN p_term = 'Final' THEN 'Final_Exam'
    ELSE REPLACE(p_term, ' ', '_')
  END;
  v_marks_term := p_academic_year || '_' || v_mapped_term;

  -- 3. Resolve Published Assessment for the student
  IF p_academic_year IS NULL OR p_term IS NULL THEN
    SELECT 
      a.id, a.academic_year_id, a.term_id, a.class_id, a.status, a.overall_comment, a.published_at,
      y.year_name, t.term_name, c.name as class_name, c.section as class_section
    INTO v_assessment 
    FROM public.hpc_student_assessments a
    JOIN public.hpc_academic_years y ON a.academic_year_id = y.id
    JOIN public.hpc_terms t ON a.term_id = t.id
    JOIN public.classes c ON a.class_id = c.id
    WHERE a.student_id = v_student.id
      AND a.status = 'published'
    ORDER BY a.created_at DESC
    LIMIT 1;
  ELSE
    SELECT 
      a.id, a.academic_year_id, a.term_id, a.class_id, a.status, a.overall_comment, a.published_at,
      y.year_name, t.term_name, c.name as class_name, c.section as class_section
    INTO v_assessment 
    FROM public.hpc_student_assessments a
    JOIN public.hpc_academic_years y ON a.academic_year_id = y.id
    JOIN public.hpc_terms t ON a.term_id = t.id
    JOIN public.classes c ON a.class_id = c.id
    WHERE a.student_id = v_student.id
      AND y.year_name = p_academic_year
      AND t.term_name = p_term
      AND a.status = 'published';
  END IF;

  IF NOT FOUND THEN 
    RETURN NULL; 
  END IF;

  -- Update v_marks_term using the resolved assessment's year and term in case they were NULL originally
  v_mapped_term := CASE
    WHEN v_assessment.term_name = 'Term 1' THEN 'Midterm_Exam'
    WHEN v_assessment.term_name = 'Term 2' THEN 'Final_Exam'
    WHEN v_assessment.term_name = 'Midterm' THEN 'Midterm_Exam'
    WHEN v_assessment.term_name = 'Final' THEN 'Final_Exam'
    ELSE REPLACE(v_assessment.term_name, ' ', '_')
  END;
  v_marks_term := v_assessment.year_name || '_' || v_mapped_term;

  -- 4. Aggregate Competencies
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'competency_name', c.name,
      'category', c.category,
      'rating', r.rating_value,
      'rating_description', l.description,
      'teacher_comment', r.teacher_comment
    )
  ), '[]'::jsonb) INTO v_competencies
  FROM public.hpc_competency_ratings r
  JOIN public.hpc_competencies c ON r.competency_id = c.id
  LEFT JOIN public.hpc_rating_scale_levels l ON r.rating_value = l.level_value AND l.scale_set_id = c.scale_set_id
  WHERE r.assessment_id = v_assessment.id;

  -- 5. Aggregate Learning Outcomes
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'subject_name', s.name,
      'outcome_code', o.outcome_code,
      'outcome_text', o.outcome_text,
      'rating', r.rating_value,
      'rating_description', l.description,
      'teacher_comment', r.teacher_comment
    )
  ), '[]'::jsonb) INTO v_outcomes
  FROM public.hpc_outcome_ratings r
  JOIN public.hpc_learning_outcomes o ON r.outcome_id = o.id
  JOIN public.subjects s ON o.subject_id = s.id
  LEFT JOIN public.hpc_rating_scale_levels l ON r.rating_value = l.level_value AND l.scale_set_id = o.scale_set_id
  WHERE r.assessment_id = v_assessment.id;

  -- 6. Aggregate Academic Marks
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'subject_name', s.name,
      'score', m.score
    )
  ), '[]'::jsonb) INTO v_marks
  FROM public.marks m
  JOIN public.subjects s ON m.subject_id = s.id
  WHERE m.student_id = v_student.id 
    AND m.term = v_marks_term;

  -- 7. Return Authorized Data
  RETURN jsonb_build_object(
    'student', jsonb_build_object(
      'id', v_student.id,
      'uid', v_student.uid,
      'name', v_student.name,
      'class', v_assessment.class_name,
      'section', v_assessment.class_section
    ),
    'assessment', jsonb_build_object(
      'id', v_assessment.id,
      'academic_year', v_assessment.year_name,
      'term', v_assessment.term_name,
      'status', v_assessment.status,
      'overall_comment', v_assessment.overall_comment,
      'published_at', v_assessment.published_at
    ),
    'competencies', v_competencies,
    'learning_outcomes', v_outcomes,
    'marks', v_marks
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_hpc_report(TEXT, TEXT, TEXT) TO anon, authenticated;
