CREATE TABLE IF NOT EXISTS public.photo_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    extracted_name TEXT,
    extracted_uid TEXT,
    confidence_score INTEGER,
    match_type TEXT,
    action_taken TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.photo_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" 
ON public.photo_audit_logs FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" 
ON public.photo_audit_logs FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');
