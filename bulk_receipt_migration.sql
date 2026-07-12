-- bulk_receipt_migration.sql

-- Enums
DO $$ BEGIN
    CREATE TYPE fee_batch_status AS ENUM ('draft', 'processed', 'reversed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE fee_batch_entry_status AS ENUM ('pending', 'success', 'failed', 'reversed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE fee_allocation_method AS ENUM ('fifo', 'manual', 'advance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Fee Batches Table
CREATE TABLE IF NOT EXISTS public.fee_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_number TEXT UNIQUE NOT NULL,
  deposit_date DATE NOT NULL,
  bank_name TEXT NOT NULL,
  branch TEXT,
  total_amount NUMERIC(12,2) NOT NULL,
  slip_count INTEGER,
  status fee_batch_status DEFAULT 'draft',
  
  institution_id TEXT DEFAULT 'GYANODAY',
  academic_session TEXT DEFAULT '2026',
  
  total_successful_entries INTEGER DEFAULT 0,
  total_failed_entries INTEGER DEFAULT 0,
  total_advance_payments NUMERIC(12,2) DEFAULT 0,
  total_duplicate_entries INTEGER DEFAULT 0,
  batch_hash TEXT,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  remarks TEXT
);

-- 2. Fee Batch Entries Table
CREATE TABLE IF NOT EXISTS public.fee_batch_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES public.fee_batches(id) ON DELETE CASCADE,
  entry_number INTEGER NOT NULL,
  student_id UUID REFERENCES public.students(id),
  student_uid TEXT,
  student_name_snapshot TEXT,
  class_snapshot TEXT,
  
  amount_paid NUMERIC(10,2) NOT NULL,
  slip_number TEXT,
  payment_mode TEXT DEFAULT 'Bank Transfer',
  allocation_method fee_allocation_method DEFAULT 'fifo',
  
  previous_outstanding NUMERIC(12,2),
  balance_after_posting NUMERIC(12,2),
  
  status fee_batch_entry_status DEFAULT 'pending',
  validation_message TEXT,
  processing_timestamp TIMESTAMPTZ,
  remarks TEXT
);

-- RLS
ALTER TABLE public.fee_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_batch_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read fee_batches" ON public.fee_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert fee_batches" ON public.fee_batches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update fee_batches" ON public.fee_batches FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read fee_batch_entries" ON public.fee_batch_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert fee_batch_entries" ON public.fee_batch_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update fee_batch_entries" ON public.fee_batch_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete fee_batch_entries" ON public.fee_batch_entries FOR DELETE TO authenticated USING (true);
