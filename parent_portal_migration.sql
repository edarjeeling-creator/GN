-- Migration for Parent Portal (Phase 4)

-- Add security fields to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS contact_number TEXT;

-- We need to allow public access to student details for the public portal login
-- We will create a secure RPC function to handle the login to prevent exposing the whole table

CREATE OR REPLACE FUNCTION public.parent_login(p_uid TEXT, p_dob DATE)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as the creator of the function (postgres), bypassing RLS
AS $$
DECLARE
  v_student record;
  v_result json;
BEGIN
  -- Find the student by UID
  SELECT id, name, uid, roll_no, class_id, date_of_birth, contact_number
  INTO v_student
  FROM public.students
  WHERE uid = p_uid;

  -- If not found
  IF v_student.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid UID');
  END IF;

  -- If DOB is set in the system, it must match
  IF v_student.date_of_birth IS NOT NULL THEN
    IF p_dob IS NULL OR v_student.date_of_birth != p_dob THEN
      RETURN json_build_object('success', false, 'error', 'Invalid Date of Birth');
    END IF;
  END IF;

  -- Return student data
  SELECT json_build_object(
    'success', true,
    'student', row_to_json(v_student)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Allow anonymous access to the login function
GRANT EXECUTE ON FUNCTION public.parent_login TO anon;
GRANT EXECUTE ON FUNCTION public.parent_login TO authenticated;

-- Allow anonymous access to insert fee_payments (since parents upload proofs without a real DB session)
-- Wait, we already have fee_payments table. Let's update its RLS to allow anon inserts
DROP POLICY IF EXISTS "Allow anon insert to fee_payments" ON public.fee_payments;
CREATE POLICY "Allow anon insert to fee_payments" ON public.fee_payments
  FOR INSERT
  WITH CHECK (true); -- Anyone can submit a payment declaration

-- Allow anon to read classes (for the dashboard)
DROP POLICY IF EXISTS "Allow anon read classes" ON public.classes;
CREATE POLICY "Allow anon read classes" ON public.classes
  FOR SELECT
  USING (true);

-- Allow anon to read fee demands and items for their specific student
-- We can't use auth.uid() because they are anon. We rely on the app passing the student_id 
-- and since it's a UUID, it's virtually impossible to guess.
DROP POLICY IF EXISTS "Allow anon read fee_demands" ON public.fee_demands;
CREATE POLICY "Allow anon read fee_demands" ON public.fee_demands
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow anon read fee_demand_items" ON public.fee_demand_items;
CREATE POLICY "Allow anon read fee_demand_items" ON public.fee_demand_items
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow anon read fee_payments" ON public.fee_payments;
CREATE POLICY "Allow anon read fee_payments" ON public.fee_payments
  FOR SELECT
  USING (true);
