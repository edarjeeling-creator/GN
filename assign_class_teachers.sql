-- Assign Class Teachers based on Profiles

UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Supriya Chettri%' AND role = 'teacher' LIMIT 1) WHERE name = '5' AND section = 'A';
UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Anupama Gurung%' AND role = 'teacher' LIMIT 1) WHERE name = '5' AND section = 'B';

UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Rajesh Singh%' AND role = 'teacher' LIMIT 1) WHERE name = '6' AND section = 'A';
UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Sagar Gurung%' AND role = 'teacher' LIMIT 1) WHERE name = '6' AND section = 'B';

UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Subodh Rai%' AND role = 'teacher' LIMIT 1) WHERE name = '7' AND section = 'A';
UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Nirjala Pradhan%' AND role = 'teacher' LIMIT 1) WHERE name = '7' AND section = 'B';

UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Rahul Chettri%' AND role = 'teacher' LIMIT 1) WHERE name = '8' AND section = 'A';
UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Pranay Pradhan%' AND role = 'teacher' LIMIT 1) WHERE name = '8' AND section = 'B';

UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Pratika Tamang%' AND role = 'teacher' LIMIT 1) WHERE name = '9' AND section = 'Humanities';
UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Urvashi Rumba%' AND role = 'teacher' LIMIT 1) WHERE name = '9' AND section = 'Science';

UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Sujata Rai%' AND role = 'teacher' LIMIT 1) WHERE name = '10' AND section = 'Humanities';
UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Dipankar Parajuli%' AND role = 'teacher' LIMIT 1) WHERE name = '10' AND section = 'Science';

UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Riwaz Pradhan%' AND role = 'teacher' LIMIT 1) WHERE name = '11' AND section = 'Humanities';
UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Suraj Pradhan%' AND role = 'teacher' LIMIT 1) WHERE name = '11' AND section = 'Science';

UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Keiran Thapa%' AND role = 'teacher' LIMIT 1) WHERE name = '12' AND section = 'Humanities';
UPDATE classes SET class_teacher_id = (SELECT id FROM profiles WHERE name ILIKE '%Pallavi Bakshi%' AND role = 'teacher' LIMIT 1) WHERE name = '12' AND section = 'Science';

