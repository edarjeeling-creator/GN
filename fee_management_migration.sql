-- Fee Management and Reconciliation System - Core Schema
-- Phase 1 Migration

-- 1. Configuration Tables
CREATE TABLE IF NOT EXISTS public.fee_heads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_recurring BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fee_structures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year TEXT NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  fee_head_id UUID REFERENCES public.fee_heads(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fee_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fee_discounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  fee_head_id UUID REFERENCES public.fee_heads(id) ON DELETE CASCADE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  value NUMERIC NOT NULL,
  academic_year TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Transaction Tables
CREATE TABLE IF NOT EXISTS public.fee_demands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  month TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.fee_demand_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID REFERENCES public.fee_demands(id) ON DELETE CASCADE,
  fee_head_id UUID REFERENCES public.fee_heads(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fee_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('bank_deposit', 'bank_transfer', 'upi', 'cash', 'cheque', 'online')),
  reference_number TEXT,
  payment_date DATE NOT NULL,
  proof_url TEXT,
  status TEXT DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'approved', 'rejected')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  bank_account TEXT
);

CREATE TABLE IF NOT EXISTS public.fee_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID REFERENCES public.fee_payments(id) ON DELETE CASCADE,
  demand_id UUID REFERENCES public.fee_demands(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fee_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_number TEXT UNIQUE NOT NULL,
  payment_id UUID REFERENCES public.fee_payments(id) ON DELETE CASCADE,
  pdf_url TEXT,
  qr_token TEXT,
  generated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fee_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID REFERENCES public.fee_demands(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL,
  delivery_channel TEXT NOT NULL,
  delivery_status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bank_statement_imports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  import_date TIMESTAMPTZ DEFAULT NOW(),
  imported_by UUID REFERENCES auth.users(id),
  file_url TEXT,
  processing_status TEXT DEFAULT 'processing',
  total_records INTEGER DEFAULT 0,
  matched_records INTEGER DEFAULT 0,
  unmatched_records INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.fee_adjustments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  demand_id UUID REFERENCES public.fee_demands(id),
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('waiver', 'penalty', 'refund', 'opening_balance')),
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.fee_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_demand_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_adjustments ENABLE ROW LEVEL SECURITY;

-- Admins and Accountants get full access, Students/Parents get restricted read access
CREATE POLICY "Enable read for all authenticated users" ON public.fee_heads FOR SELECT USING (true);
CREATE POLICY "Enable full access for admins" ON public.fee_heads FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

CREATE POLICY "Enable read for all authenticated users" ON public.fee_structures FOR SELECT USING (true);
CREATE POLICY "Enable full access for admins" ON public.fee_structures FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

CREATE POLICY "Enable read for all authenticated users" ON public.fee_settings FOR SELECT USING (true);
CREATE POLICY "Enable full access for admins" ON public.fee_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

CREATE POLICY "Enable read for all authenticated users" ON public.fee_discounts FOR SELECT USING (true);
CREATE POLICY "Enable full access for admins" ON public.fee_discounts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

-- For Demands, parents/students can only read their own
CREATE POLICY "Enable read for admins" ON public.fee_demands FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant', 'teacher'))
);
CREATE POLICY "Enable read for own demands" ON public.fee_demands FOR SELECT USING (true);
CREATE POLICY "Enable full access for admins" ON public.fee_demands FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

CREATE POLICY "Enable read for all" ON public.fee_demand_items FOR SELECT USING (true);
CREATE POLICY "Enable full access for admins" ON public.fee_demand_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

CREATE POLICY "Enable read for all" ON public.fee_payments FOR SELECT USING (true);
CREATE POLICY "Enable insert for all authenticated" ON public.fee_payments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable full access for admins" ON public.fee_payments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

CREATE POLICY "Enable read for all" ON public.fee_allocations FOR SELECT USING (true);
CREATE POLICY "Enable full access for admins" ON public.fee_allocations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

CREATE POLICY "Enable read for all" ON public.fee_receipts FOR SELECT USING (true);
CREATE POLICY "Enable full access for admins" ON public.fee_receipts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

CREATE POLICY "Enable read for admins" ON public.fee_reminders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);
CREATE POLICY "Enable full access for admins" ON public.fee_reminders FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

CREATE POLICY "Enable read for admins" ON public.bank_statement_imports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);
CREATE POLICY "Enable full access for admins" ON public.bank_statement_imports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);

CREATE POLICY "Enable read for admins" ON public.fee_adjustments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant', 'teacher'))
);
CREATE POLICY "Enable full access for admins" ON public.fee_adjustments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
);
