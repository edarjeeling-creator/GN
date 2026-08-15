INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments', 
  'chat-attachments', 
  true, 
  10485760, -- 10MB
  '{"image/jpeg","image/png","image/gif","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"}'
)
ON CONFLICT (id) DO UPDATE SET public = true;
