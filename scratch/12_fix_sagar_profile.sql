-- Fix the profile for sagar@gyanodayniketan.cloud
DO $$
DECLARE
  v_user_id uuid;
  v_name text;
  v_role text;
  v_school_id uuid;
BEGIN
  -- Get the user id
  SELECT id, 
         COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Sagar Gurung'),
         COALESCE(raw_user_meta_data->>'role', 'teacher'),
         (raw_user_meta_data->>'school_id')::uuid
  INTO v_user_id, v_name, v_role, v_school_id
  FROM auth.users 
  WHERE email = 'sagar@gyanodayniketan.cloud';
  
  IF v_user_id IS NOT NULL THEN
    -- Check if profile exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
      -- Insert missing profile
      INSERT INTO public.profiles (id, name, role, school_id)
      VALUES (v_user_id, v_name, v_role, v_school_id);
      
      RAISE NOTICE 'Profile created for user %', v_user_id;
    ELSE
      -- Update existing profile just in case it's misconfigured
      UPDATE public.profiles
      SET name = v_name, role = v_role, school_id = v_school_id
      WHERE id = v_user_id;
      
      RAISE NOTICE 'Profile updated for user %', v_user_id;
    END IF;
  ELSE
    RAISE NOTICE 'User not found in auth.users';
  END IF;
END;
$$;
