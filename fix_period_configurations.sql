-- Enable RLS and permissive policies for period_configurations
CREATE TABLE IF NOT EXISTS public.period_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID,
    campus_id UUID,
    period_num INTEGER NOT NULL CHECK (period_num BETWEEN 1 AND 12),
    period_name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_break BOOLEAN DEFAULT false,
    is_special BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    day_applicability JSONB DEFAULT '[1, 2, 3, 4, 5]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_num)
);

ALTER TABLE public.period_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read period_configurations" ON public.period_configurations;
DROP POLICY IF EXISTS "Allow write period_configurations" ON public.period_configurations;
DROP POLICY IF EXISTS "Allow read period_configurations_anon" ON public.period_configurations;
DROP POLICY IF EXISTS "Allow write period_configurations_anon" ON public.period_configurations;

CREATE POLICY "Allow read period_configurations" ON public.period_configurations FOR SELECT USING (true);
CREATE POLICY "Allow write period_configurations" ON public.period_configurations FOR ALL USING (true);

-- Insert or update the authentic Gyanoday Niketan period timing configuration (8:15 start)
INSERT INTO public.period_configurations (period_num, period_name, start_time, end_time, is_break, is_special, is_active)
VALUES 
  (1, '1st Period', '08:15', '08:55', false, false, true),
  (2, '2nd Period', '08:55', '09:35', false, false, true),
  (3, '3rd Period', '09:35', '10:15', false, false, true),
  (4, '4th Period', '10:30', '11:10', false, false, true),
  (5, '5th Period', '11:10', '11:50', false, false, true),
  (6, '6th Period', '12:30', '13:10', false, false, true),
  (7, '7th Period', '13:10', '13:50', false, false, true),
  (8, '8th Period', '13:50', '14:30', false, false, true),
  (9, '9th Period', '14:30', '15:10', false, true, true)
ON CONFLICT (period_num) DO UPDATE SET
  period_name = EXCLUDED.period_name,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  is_break = EXCLUDED.is_break,
  is_special = EXCLUDED.is_special,
  is_active = EXCLUDED.is_active;
