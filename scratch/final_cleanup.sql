DO $$ 
DECLARE 
  r RECORD;
BEGIN
  -- We delete any user that was created using the broken SQL bypass.
  -- This ensures their email can be reused properly.
  FOR r IN SELECT id FROM auth.users WHERE email IN ('rajesh@gyanodayniketan.cloud', 'subodh@gyanodayniketan.cloud', 'teacher@gyanodayniketan.cloud')
  LOOP
    DELETE FROM public.lib_members WHERE user_id = r.id;
    DELETE FROM public.profiles WHERE id = r.id;
    DELETE FROM auth.identities WHERE user_id = r.id;
    DELETE FROM auth.users WHERE id = r.id;
  END LOOP;
END $$;
