-- Step 1: Clean up the corrupted manual user
DELETE FROM auth.users WHERE email = 'accountant@gyanodayniketan.cloud';

-- Step 2: (AFTER you create the user in the dashboard without Auto-Confirm)
-- This confirms their email and gives them admin access
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email = 'accountant@gyanodayniketan.cloud';

UPDATE public.profiles 
SET name = 'School Accountant', role = 'admin'
WHERE id IN (SELECT id FROM auth.users WHERE email = 'accountant@gyanodayniketan.cloud');
