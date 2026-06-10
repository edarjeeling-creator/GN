-- Run this script in your Supabase SQL Editor to fix Student access to Python Patshala
ALTER TABLE public.feature_access ENABLE ROW LEVEL SECURITY;

-- Allow anyone logged in to see which features are enabled for them
CREATE POLICY "Allow authenticated read feature_access" 
ON public.feature_access 
FOR SELECT 
TO authenticated 
USING (true);

-- Allow admins and principals to manage feature access
CREATE POLICY "Allow admin manage feature_access" 
ON public.feature_access 
FOR ALL 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'principal', 'superadmin')));
