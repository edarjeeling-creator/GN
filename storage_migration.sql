-- Create storage bucket for chat attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Ensure the bucket is private
UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';

-- Drop old policies if they exist (to ensure a clean slate)
DROP POLICY IF EXISTS "Allow public read chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can read attachments of their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments to their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;

-- Create secure SELECT policy (Read access)
-- Allows reading if the user is a member of the conversation specified in the second segment of the file path.
CREATE POLICY "Users can read attachments of their conversations" 
ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'chat-attachments' 
  AND EXISTS (
    SELECT 1 FROM public.conversation_members cm 
    WHERE cm.conversation_id = (string_to_array(name, '/'))[2]::uuid 
    AND cm.profile_id = auth.uid()
  )
);

-- Create secure INSERT policy (Upload access)
-- Allows uploading if the user is a member of the conversation.
CREATE POLICY "Users can upload attachments to their conversations" 
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'chat-attachments' 
  AND EXISTS (
    SELECT 1 FROM public.conversation_members cm 
    WHERE cm.conversation_id = (string_to_array(name, '/'))[2]::uuid 
    AND cm.profile_id = auth.uid()
  )
);

-- Create secure UPDATE policy
-- Allows users to update/overwrite files they uploaded themselves.
CREATE POLICY "Users can update their own attachments"
ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'chat-attachments' 
  AND owner = auth.uid()
);

-- Create secure DELETE policy
-- Allows users to delete files they uploaded themselves.
CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'chat-attachments' 
  AND owner = auth.uid()
);
