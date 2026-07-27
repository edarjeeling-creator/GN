-- 1. Add missing columns to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS father_name TEXT,
ADD COLUMN IF NOT EXISTS dob DATE,
ADD COLUMN IF NOT EXISTS blood_group TEXT,
ADD COLUMN IF NOT EXISTS contact_number TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS picture_url TEXT,
ADD COLUMN IF NOT EXISTS id_details_status TEXT DEFAULT 'Not Sent',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Add missing columns to profiles table (used for teachers)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS designation TEXT,
ADD COLUMN IF NOT EXISTS employee_id TEXT,
ADD COLUMN IF NOT EXISTS dob DATE,
ADD COLUMN IF NOT EXISTS blood_group TEXT,
ADD COLUMN IF NOT EXISTS contact_number TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS picture_url TEXT,
ADD COLUMN IF NOT EXISTS id_details_status TEXT DEFAULT 'Not Sent',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Create or replace the function to handle ID Form Submissions
DROP FUNCTION IF EXISTS public.submit_id_form(text, jsonb);
DROP FUNCTION IF EXISTS public.submit_id_form(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.submit_id_form(p_token text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_validation jsonb;
    v_user_id uuid;
    v_role text;
BEGIN
    -- Validate the token using the existing validation function (cast text to uuid)
    v_validation := public.validate_form_token(p_token::uuid);
    
    IF NOT (v_validation->>'valid')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', COALESCE(v_validation->>'outcome', 'INVALID_TOKEN')
        );
    END IF;

    -- Extract user details from the validation result
    v_user_id := (v_validation->>'user_id')::uuid;
    v_role := v_validation->>'role';

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'ERROR_NO_USER_ID'
        );
    END IF;

    -- Update the appropriate table based on role
    IF v_role = 'student' THEN
        UPDATE public.students
        SET
            father_name = p_data->>'father_name',
            dob = (p_data->>'dob')::date,
            blood_group = p_data->>'blood_group',
            contact_number = p_data->>'contact_number',
            address = p_data->>'address',
            picture_url = COALESCE(p_data->>'picture_path', picture_url),
            id_details_status = 'Completed',
            updated_at = NOW()
        WHERE id = v_user_id;

    ELSIF v_role = 'teacher' THEN
        UPDATE public.profiles
        SET
            designation = COALESCE(p_data->>'designation', designation),
            employee_id = COALESCE(p_data->>'employee_id', employee_id),
            dob = (p_data->>'dob')::date,
            blood_group = p_data->>'blood_group',
            contact_number = p_data->>'contact_number',
            address = p_data->>'address',
            picture_url = COALESCE(p_data->>'picture_path', picture_url),
            id_details_status = 'Completed',
            updated_at = NOW()
        WHERE id = v_user_id;

    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'UNKNOWN_ROLE'
        );
    END IF;

    -- Invalidate the token (fail gracefully if the tokens table doesn't exist)
    BEGIN
        UPDATE public.id_form_tokens
        SET 
            used_at = NOW(),
            status = 'used'
        WHERE token = p_token;
    EXCEPTION WHEN undefined_table THEN
        -- Safely ignore if the tokens table is named differently or not used
    END;

    -- Return success
    RETURN jsonb_build_object(
        'success', true,
        'outcome', 'SUBMITTED'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'outcome', 'DB_ERROR: ' || SQLERRM
    );
END;
$$;
