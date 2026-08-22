SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('python_assignments', 'python_lessons');
