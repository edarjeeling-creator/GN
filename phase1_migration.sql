-- Phase 1 Migration: Security & Data Integrity

-- ==========================================
-- 1. Marks & Attendance RLS
-- ==========================================
-- Drop existing insecure multi-tenant policies
DROP POLICY IF EXISTS "Marks multi-tenant insert" ON public.marks;
DROP POLICY IF EXISTS "Marks multi-tenant update" ON public.marks;
DROP POLICY IF EXISTS "Marks multi-tenant delete" ON public.marks;

DROP POLICY IF EXISTS "Attendance multi-tenant insert" ON public.attendance;
DROP POLICY IF EXISTS "Attendance multi-tenant update" ON public.attendance;

-- Recreate them to explicitly require Teacher or Admin role in JWT
CREATE POLICY "Marks multi-tenant insert restricted" ON public.marks FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('teacher', 'admin') AND
    school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5')
  );

CREATE POLICY "Marks multi-tenant update restricted" ON public.marks FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('teacher', 'admin') AND
    school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5')
  );

CREATE POLICY "Marks multi-tenant delete restricted" ON public.marks FOR DELETE TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('teacher', 'admin') AND
    school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5')
  );

CREATE POLICY "Attendance multi-tenant insert restricted" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('teacher', 'admin') AND
    school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5')
  );

CREATE POLICY "Attendance multi-tenant update restricted" ON public.attendance FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('teacher', 'admin') AND
    school_id = COALESCE((auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid, 'd3b07384-d113-4956-a5ec-9af2c61146e5')
  );

-- ==========================================
-- 2. Fee Payments Security (Parent Portal)
-- ==========================================
-- Remove unrestricted SELECT for anon on fee_payments and fee_demands
DROP POLICY IF EXISTS "Allow anon read fee_payments" ON public.fee_payments;
DROP POLICY IF EXISTS "Allow anon read fee_demands" ON public.fee_demands;
DROP POLICY IF EXISTS "Allow anon read fee_demand_items" ON public.fee_demand_items;

-- Create a SECURITY DEFINER function to allow the Parent Portal to fetch exactly the data for ONE student
CREATE OR REPLACE FUNCTION get_parent_portal_data(p_student_id UUID)
RETURNS json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_demands json;
  v_payments json;
BEGIN
  -- We rely on the UUID being unguessable. If they have the student_id UUID, they can fetch.
  SELECT COALESCE(json_agg(row_to_json(d)), '[]') INTO v_demands
  FROM (
    SELECT fd.*, 
           (SELECT json_agg(row_to_json(fdi)) FROM public.fee_demand_items fdi WHERE fdi.demand_id = fd.id) as items
    FROM public.fee_demands fd
    WHERE fd.student_id = p_student_id
  ) d;

  SELECT COALESCE(json_agg(row_to_json(p)), '[]') INTO v_payments
  FROM (
    SELECT * FROM public.fee_payments
    WHERE student_id = p_student_id
  ) p;

  RETURN json_build_object(
    'demands', v_demands,
    'payments', v_payments
  );
END;
$$;

-- Grant EXECUTE to anon and authenticated
GRANT EXECUTE ON FUNCTION get_parent_portal_data(UUID) TO anon, authenticated;

-- ==========================================
-- 3. Duplicate Fee Demands
-- ==========================================
ALTER TABLE public.fee_demands 
  ADD CONSTRAINT unique_student_month UNIQUE (student_id, academic_year, month);

-- ==========================================
-- 4. Future Attendance Dates
-- ==========================================
ALTER TABLE public.attendance 
  ADD CONSTRAINT attendance_date_check CHECK (date <= CURRENT_DATE);

-- ==========================================
-- 5. Class Deletion Protection
-- ==========================================
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_class_id_fkey,
  ADD CONSTRAINT students_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE RESTRICT;

ALTER TABLE public.teacher_subjects
  DROP CONSTRAINT IF EXISTS teacher_subjects_class_id_fkey,
  ADD CONSTRAINT teacher_subjects_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE RESTRICT;

ALTER TABLE public.fee_structures
  DROP CONSTRAINT IF EXISTS fee_structures_class_id_fkey,
  ADD CONSTRAINT fee_structures_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE RESTRICT;
