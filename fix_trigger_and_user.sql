-- Step 1: Fix the Database Trigger that was crashing Supabase Studio!
-- We need to handle cases where 'full_name' is missing when creating a user from the Studio UI.
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'System User'), 
    COALESCE(new.raw_user_meta_data->>'role', 'teacher')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Delete the broken manual user completely so we can start fresh
DELETE FROM auth.users WHERE email = 'accountant@gyanodayniketan.cloud';
