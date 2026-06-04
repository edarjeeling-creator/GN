CREATE OR REPLACE FUNCTION lookup_teacher_email_by_name(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
BEGIN
  -- Look up teacher/admin in profiles
  SELECT id INTO v_user_id FROM public.profiles WHERE name ILIKE p_name AND (role = 'teacher' OR role = 'admin') LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Get their email from auth.users (Security Definer allows this)
    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    RETURN v_email;
  END IF;

  RETURN NULL;
END;
$$;
