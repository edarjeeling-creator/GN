-- seed_superadmin.sql
-- WARNING: Execute this script ONLY ONCE to grant Super Administrator privileges to the initial account.
-- After execution, archive or delete this script immediately.

DO $$
DECLARE
  target_email TEXT := 'principal@gyanodayniketan.cloud';
  target_user_id UUID;
BEGIN
  -- Find the user by email in auth.users
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email LIMIT 1;

  IF target_user_id IS NOT NULL THEN
    -- Update the profile role to superadmin
    UPDATE public.profiles SET role = 'superadmin' WHERE id = target_user_id;
    
    -- Log the security event
    INSERT INTO public.security_events (event_type, target_id, details, created_at)
    VALUES (
      'RoleChange', 
      target_user_id, 
      jsonb_build_object('method', 'seed_script', 'new_role', 'superadmin'), 
      NOW()
    );
    
    RAISE NOTICE 'Successfully promoted % to superadmin.', target_email;
  ELSE
    RAISE NOTICE 'User with email % not found.', target_email;
  END IF;
END $$;
