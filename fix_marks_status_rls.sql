ALTER TABLE public.marks_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read marks_status" ON public.marks_status;
DROP POLICY IF EXISTS "Allow anonymous read marks_status" ON public.marks_status;

CREATE POLICY "Allow anonymous read marks_status" 
ON public.marks_status 
FOR SELECT 
USING (true);

-- Also ensure generated_reports can be read
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read generated_reports" ON public.generated_reports;
CREATE POLICY "Allow read generated_reports" 
ON public.generated_reports 
FOR SELECT 
USING (true);
