-- Migration: Allow authenticated staff/teachers to insert and update students table, and provide secure RPC
-- Date: 2026-09-30

-- 1. Ensure required columns exist on public.students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS contact_number TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Enable RLS on students (idempotent)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 3. Clean up any existing duplicate policies to prevent collision
DROP POLICY IF EXISTS "Allow authenticated read students" ON public.students;
DROP POLICY IF EXISTS "Allow authenticated insert students" ON public.students;
DROP POLICY IF EXISTS "Allow authenticated update students" ON public.students;
DROP POLICY IF EXISTS "Allow authenticated delete students" ON public.students;
DROP POLICY IF EXISTS "Allow teacher read students" ON public.students;
DROP POLICY IF EXISTS "Allow public read students" ON public.students;
DROP POLICY IF EXISTS "Allow staff to update students" ON public.students;

-- 4. Re-create clean, permissive policies for authenticated users
-- SELECT: All authenticated users can read students
CREATE POLICY "Allow authenticated read students" 
ON public.students 
FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Authenticated users (teachers, staff, admins) can insert students
CREATE POLICY "Allow authenticated insert students" 
ON public.students 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- UPDATE: Authenticated users can update student records (phone, language, roll_no, class, etc.)
CREATE POLICY "Allow authenticated update students" 
ON public.students 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- DELETE: Only administrative staff (admin, principal, coordinator) can delete student records
CREATE POLICY "Allow authenticated delete students" 
ON public.students 
FOR DELETE 
TO authenticated 
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles 
    WHERE role IN ('admin', 'principal', 'coordinator')
  )
);

-- 5. Dedicated RPC for updating student contact numbers with SECURITY DEFINER
-- Ensures phone number updates succeed with high reliability and row verification
CREATE OR REPLACE FUNCTION public.update_student_contact_number(
    p_student_id UUID,
    p_contact_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_contact TEXT;
    v_updated_row JSONB;
BEGIN
    -- Verify caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Clean contact number: keep digits and leading +
    v_clean_contact := NULLIF(regexp_replace(COALESCE(p_contact_number, ''), '[^\d+]', '', 'g'), '');

    -- Perform update
    UPDATE public.students
    SET contact_number = v_clean_contact,
        updated_at = NOW()
    WHERE id = p_student_id
    RETURNING to_jsonb(students.*) INTO v_updated_row;

    IF v_updated_row IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Student not found or no rows updated'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'data', v_updated_row
    );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.update_student_contact_number(UUID, TEXT) TO authenticated;
