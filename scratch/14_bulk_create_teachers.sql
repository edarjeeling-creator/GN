-- Replace the email, password, and name for each teacher you want to create.
-- The school_id 'd3b07384-d113-4956-a5ec-9af2c61146e5' is for Gyanoday Niketan.

SELECT public.create_teacher_bypass(
  'teacher1@gyanodayniketan.cloud',  -- email
  'Password123!',                    -- password (they can change it later)
  'Rahul Sharma',                    -- full name
  'd3b07384-d113-4956-a5ec-9af2c61146e5' -- school_id
);

SELECT public.create_teacher_bypass(
  'teacher2@gyanodayniketan.cloud', 
  'Password123!', 
  'Priya Patel', 
  'd3b07384-d113-4956-a5ec-9af2c61146e5'
);

SELECT public.create_teacher_bypass(
  'teacher3@gyanodayniketan.cloud', 
  'Password123!', 
  'Amit Kumar', 
  'd3b07384-d113-4956-a5ec-9af2c61146e5'
);

-- Add as many as you need below using the same format!
