-- Fix RLS Policies for Supabase Storage (portal-files bucket)
-- This unblocks students from uploading assignment files.

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Allow any authenticated user to upload files to 'portal-files'
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads" 
ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'portal-files');

-- 2. Allow any authenticated user to read files from 'portal-files'
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
CREATE POLICY "Allow authenticated reads" 
ON storage.objects 
FOR SELECT TO authenticated 
USING (bucket_id = 'portal-files');

-- 3. Allow authenticated users to update their files (or just any file for simplicity)
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
CREATE POLICY "Allow authenticated updates" 
ON storage.objects 
FOR UPDATE TO authenticated 
USING (bucket_id = 'portal-files');

-- 4. Allow authenticated users to delete files
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
CREATE POLICY "Allow authenticated deletes" 
ON storage.objects 
FOR DELETE TO authenticated 
USING (bucket_id = 'portal-files');
