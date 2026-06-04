-- 1. Add picture_url column to students table
ALTER TABLE public.students ADD COLUMN picture_url TEXT;

-- 2. Create the Storage Bucket for student profiles
INSERT INTO storage.buckets (id, name, public) 
VALUES ('student-profiles', 'student-profiles', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage Policies
-- Allow public access to view images
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'student-profiles' );

-- Allow authenticated users to insert/update images
CREATE POLICY "Auth Insert" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'student-profiles' AND auth.role() = 'authenticated' );

CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'student-profiles' AND auth.role() = 'authenticated' );

CREATE POLICY "Auth Delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'student-profiles' AND auth.role() = 'authenticated' );
