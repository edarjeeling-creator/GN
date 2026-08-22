ALTER TABLE public.python_lessons ADD COLUMN IF NOT EXISTS module TEXT;
ALTER TABLE public.python_lessons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.python_lessons ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.python_lessons ADD COLUMN IF NOT EXISTS visibility JSONB DEFAULT '{"isGlobal": true, "classes": [], "students": []}'::jsonb;

ALTER TABLE public.python_assignments ADD COLUMN IF NOT EXISTS module TEXT;
ALTER TABLE public.python_assignments ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE public.python_assignments ADD COLUMN IF NOT EXISTS starter_code TEXT;
ALTER TABLE public.python_assignments ADD COLUMN IF NOT EXISTS visibility JSONB DEFAULT '{"isGlobal": true, "classes": [], "students": []}'::jsonb;

-- Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
