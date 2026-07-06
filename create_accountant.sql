-- Instructions for creating the Accountant User
-- 1. Go to your Supabase Dashboard -> Authentication -> Users
-- 2. Click "Add User" -> "Create New User"
-- 3. Enter Email: accountant@gyanodayniketan.cloud
-- 4. Enter Password: password123 (or whatever you prefer)
-- 5. Uncheck "Auto Confirm User" if you want to manually verify, otherwise leave it checked (or just check "Auto Confirm" to make it instant).
-- 6. Click "Create User".

-- ONCE the user is created in Authentication, copy their new UUID, or simply run the SQL below in the SQL Editor:

INSERT INTO public.profiles (id, name, role)
SELECT id, 'School Accountant', 'accountant'
FROM auth.users
WHERE email = 'accountant@gyanodayniketan.cloud'
ON CONFLICT (id) DO UPDATE SET role = 'accountant', name = 'School Accountant';
