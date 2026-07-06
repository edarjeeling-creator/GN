-- library_migration.sql

-- 1. Enums & Custom Types
DO $$ BEGIN
    CREATE TYPE lib_member_type AS ENUM ('student', 'teacher', 'staff', 'principal', 'librarian');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE lib_copy_status AS ENUM ('available', 'issued', 'reserved', 'lost', 'damaged', 'withdrawn', 'repair');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE lib_transaction_status AS ENUM ('issued', 'returned', 'overdue', 'lost');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE lib_fine_status AS ENUM ('unpaid', 'paid', 'waived', 'partial');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE lib_reservation_status AS ENUM ('active', 'fulfilled', 'cancelled', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Core Tables
CREATE TABLE IF NOT EXISTS public.lib_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lib_publishers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lib_authors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  biography TEXT,
  nationality TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lib_vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  gst_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lib_books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  isbn TEXT,
  accession_prefix TEXT,
  title TEXT NOT NULL,
  subtitle TEXT,
  category_id UUID REFERENCES public.lib_categories(id),
  publisher_id UUID REFERENCES public.lib_publishers(id),
  subject TEXT,
  keywords TEXT,
  language TEXT DEFAULT 'English',
  edition TEXT,
  pages INTEGER,
  publication_year INTEGER,
  cover_image_url TEXT,
  purchase_cost NUMERIC(10,2),
  estimated_value NUMERIC(10,2),
  dewey_decimal TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lib_book_authors (
  book_id UUID REFERENCES public.lib_books(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.lib_authors(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, author_id)
);

CREATE TABLE IF NOT EXISTS public.lib_book_copies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID REFERENCES public.lib_books(id) ON DELETE CASCADE,
  accession_number TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  qr_code TEXT UNIQUE,
  rfid_tag TEXT UNIQUE,
  shelf_location TEXT,
  status lib_copy_status DEFAULT 'available',
  condition_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lib_purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  vendor_id UUID REFERENCES public.lib_vendors(id),
  invoice_number TEXT,
  invoice_date DATE,
  purchase_date DATE,
  total_cost NUMERIC(12,2),
  funding_source TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Library Members
CREATE TABLE IF NOT EXISTS public.lib_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id), 
  student_id UUID REFERENCES public.students(id), 
  member_type lib_member_type NOT NULL,
  membership_number TEXT UNIQUE,
  joining_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lib_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_type lib_member_type UNIQUE NOT NULL,
  max_books INTEGER NOT NULL DEFAULT 2,
  issue_days INTEGER NOT NULL DEFAULT 14,
  fine_per_day NUMERIC(10,2) DEFAULT 0,
  max_renewals INTEGER DEFAULT 1,
  grace_period_days INTEGER DEFAULT 0,
  exclude_holidays BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lib_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  copy_id UUID REFERENCES public.lib_book_copies(id) ON DELETE RESTRICT,
  member_id UUID REFERENCES public.lib_members(id) ON DELETE RESTRICT,
  issued_by UUID REFERENCES auth.users(id),
  issue_date TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  return_date TIMESTAMPTZ,
  returned_to UUID REFERENCES auth.users(id),
  renew_count INTEGER DEFAULT 0,
  status lib_transaction_status DEFAULT 'issued',
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lib_fines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES public.lib_transactions(id),
  member_id UUID REFERENCES public.lib_members(id),
  fine_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  waived_amount NUMERIC(10,2) DEFAULT 0,
  collected_amount NUMERIC(10,2) DEFAULT 0,
  status lib_fine_status DEFAULT 'unpaid',
  payment_date TIMESTAMPTZ,
  collected_by UUID REFERENCES auth.users(id),
  waived_by UUID REFERENCES auth.users(id),
  waiver_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lib_reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID REFERENCES public.lib_books(id),
  member_id UUID REFERENCES public.lib_members(id),
  reservation_date TIMESTAMPTZ DEFAULT NOW(),
  expiry_date TIMESTAMPTZ,
  status lib_reservation_status DEFAULT 'active',
  fulfilled_copy_id UUID REFERENCES public.lib_book_copies(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lib_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES public.lib_members(id),
  reminder_type TEXT, 
  delivery_method TEXT, 
  delivery_status TEXT DEFAULT 'pending',
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.lib_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic RLS setup
ALTER TABLE public.lib_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lib_publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lib_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lib_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lib_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lib_book_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lib_book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lib_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lib_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lib_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lib_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lib_fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lib_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lib_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lib_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check library access
CREATE OR REPLACE FUNCTION public.is_library_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'librarian', 'principal')
  );
$$;

-- Select policies for authenticated users to browse catalog
DO $$ BEGIN
  CREATE POLICY "Allow authenticated read lib_categories" ON public.lib_categories FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read lib_publishers" ON public.lib_publishers FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read lib_authors" ON public.lib_authors FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read lib_books" ON public.lib_books FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read lib_book_authors" ON public.lib_book_authors FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read lib_book_copies" ON public.lib_book_copies FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Apply library admin policies to all tables for all operations
DO $$ BEGIN
  CREATE POLICY "Librarian all lib_categories" ON public.lib_categories FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Librarian all lib_publishers" ON public.lib_publishers FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Librarian all lib_authors" ON public.lib_authors FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Librarian all lib_vendors" ON public.lib_vendors FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Librarian all lib_books" ON public.lib_books FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Librarian all lib_book_authors" ON public.lib_book_authors FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Librarian all lib_book_copies" ON public.lib_book_copies FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Librarian all lib_purchase_orders" ON public.lib_purchase_orders FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Librarian all lib_members" ON public.lib_members FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Librarian all lib_settings" ON public.lib_settings FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Librarian all lib_transactions" ON public.lib_transactions FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Librarian all lib_fines" ON public.lib_fines FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Librarian all lib_reservations" ON public.lib_reservations FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Librarian all lib_notifications" ON public.lib_notifications FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Librarian all lib_audit_logs" ON public.lib_audit_logs FOR ALL USING (is_library_admin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Members can see their own data
DO $$ BEGIN
  CREATE POLICY "Members see own lib_members" ON public.lib_members FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Members see own transactions" ON public.lib_transactions FOR SELECT USING (
    member_id IN (SELECT id FROM public.lib_members WHERE user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Members see own fines" ON public.lib_fines FOR SELECT USING (
    member_id IN (SELECT id FROM public.lib_members WHERE user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Members see own reservations" ON public.lib_reservations FOR SELECT USING (
    member_id IN (SELECT id FROM public.lib_members WHERE user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Members create own reservations" ON public.lib_reservations FOR INSERT WITH CHECK (
    member_id IN (SELECT id FROM public.lib_members WHERE user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Members see own notifications" ON public.lib_notifications FOR SELECT USING (
    member_id IN (SELECT id FROM public.lib_members WHERE user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Initial Configuration Defaults
INSERT INTO public.lib_settings (member_type, max_books, issue_days, fine_per_day, max_renewals, grace_period_days, exclude_holidays)
VALUES 
  ('student', 2, 14, 2.00, 1, 0, true),
  ('teacher', 10, 30, 0.00, 2, 0, true),
  ('staff', 5, 30, 0.00, 1, 0, true),
  ('principal', 20, 60, 0.00, 3, 0, true),
  ('librarian', 20, 60, 0.00, 3, 0, true)
ON CONFLICT (member_type) DO NOTHING;

-- Initial Base Categories
INSERT INTO public.lib_categories (name, description, display_order)
VALUES 
  ('Fiction', 'Storybooks, Novels, Literature', 1),
  ('Non-Fiction', 'Fact-based books, Essays', 2),
  ('Science', 'Physics, Chemistry, Biology', 3),
  ('Mathematics', 'Algebra, Geometry, Arithmetic', 4),
  ('Computer', 'Programming, Tech, Software', 5),
  ('History', 'World History, Indian History', 6),
  ('Geography', 'Maps, Earth Science', 7),
  ('Reference', 'Dictionaries, Encyclopedias', 8),
  ('Biography', 'Life stories of notable people', 9)
ON CONFLICT (name) DO NOTHING;

-- Update handle_new_user trigger to support librarian
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $local$
BEGIN
  -- We allow the role to be passed in from the signup metadata, default to 'teacher'
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'Unknown User'), COALESCE(new.raw_user_meta_data->>'role', 'teacher'));
  RETURN new;
END;
$local$ LANGUAGE plpgsql SECURITY DEFINER;
