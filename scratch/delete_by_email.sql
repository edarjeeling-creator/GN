DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT id, email FROM auth.users WHERE email LIKE '%rajesh%' OR email LIKE '%subodh%' OR email LIKE '%test%'
  LOOP
    DELETE FROM public.lib_members WHERE user_id = r.id;
    DELETE FROM public.profiles WHERE id = r.id;
    DELETE FROM auth.identities WHERE user_id = r.id;
    DELETE FROM auth.users WHERE id = r.id;
  END LOOP;
END $$;
