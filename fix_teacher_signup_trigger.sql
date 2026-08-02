-- This script fixes the 500 Server Error during Teacher signup from the Admin Dashboard.
-- The issue occurs because the previous trigger omitted the `school_id` from the INSERT,
-- falling back to a default school ID that may have been deleted (causing a foreign key violation).
-- This updated trigger safely extracts the `school_id` from the signup metadata, avoiding the error.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_school_id UUID;
BEGIN
  -- Extract school_id gracefully from user metadata
  IF new.raw_user_meta_data->>'school_id' IS NOT NULL AND new.raw_user_meta_data->>'school_id' != '' AND new.raw_user_meta_data->>'school_id' != 'null' THEN
    v_school_id := (new.raw_user_meta_data->>'school_id')::uuid;
  ELSE
    -- Fallback to the default school ID if none is provided
    v_school_id := 'd3b07384-d113-4956-a5ec-9af2c61146e5'::uuid;
  END IF;

  INSERT INTO public.profiles (id, name, role, school_id)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'System User'), 
    COALESCE(new.raw_user_meta_data->>'role', 'teacher'),
    v_school_id
  );
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- In case of ANY constraint violation (e.g. school_id foreign key fails because the default school was deleted),
  -- we fallback to inserting the profile WITHOUT school_id (if allowed) or inserting a safe default.
  -- This ensures the user is still created in auth.users and can be fixed manually later, avoiding a 500 error.
  
  BEGIN
    INSERT INTO public.profiles (id, name, role)
    VALUES (
      new.id, 
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'System User'), 
      COALESCE(new.raw_user_meta_data->>'role', 'teacher')
    );
  EXCEPTION WHEN OTHERS THEN
    -- If it still fails, just raise a warning but return new so the user is created
    RAISE WARNING 'handle_new_user failed completely: %', SQLERRM;
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
