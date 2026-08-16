-- Fix Class Teachers based on Profiles (Using more flexible ILIKE matches and correct Section codes)

UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Subodh%' AND role = 'teacher' LIMIT 1) WHERE name = '7' AND section = 'A';

UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Pratika%' AND role = 'teacher' LIMIT 1) WHERE name = '9' AND section = 'H';
UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Urvashi%' AND role = 'teacher' LIMIT 1) WHERE name = '9' AND section = 'Sc';

UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Sujata%' AND role = 'teacher' LIMIT 1) WHERE name = '10' AND section = 'H';
UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Dipank%' AND role = 'teacher' LIMIT 1) WHERE name = '10' AND section = 'Sc';

UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Riwaz%' AND role = 'teacher' LIMIT 1) WHERE name = '11' AND section = 'H';
UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Suraj%' AND role = 'teacher' LIMIT 1) WHERE name = '11' AND section = 'Sc';

UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Keiran%' AND role = 'teacher' LIMIT 1) WHERE name = '12' AND section = 'H';
UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Pallavi%' AND role = 'teacher' LIMIT 1) WHERE name = '12' AND section = 'Sc';
