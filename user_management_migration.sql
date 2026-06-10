-- user_management_migration.sql
-- Run this script in your Supabase SQL Editor to apply User Management v2 Schema

-- 1. Modify public.profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended', 'Archived')),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS employee_id TEXT,
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- 2. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.user_management_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Security Events Table
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- 'FailedLogin', 'PasswordReset', 'AccountLock', 'RoleChange', 'Suspension', 'BulkImport'
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_id UUID,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Parent-Student Mapping Table
CREATE TABLE IF NOT EXISTS public.parent_student_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'Parent',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);

-- 5. Set up Row Level Security (RLS)
ALTER TABLE public.user_management_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_map ENABLE ROW LEVEL SECURITY;

-- Audit Logs Policies
CREATE POLICY "Allow superadmin read audit logs" ON public.user_management_audit_logs 
FOR SELECT TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Allow superadmin insert audit logs" ON public.user_management_audit_logs 
FOR INSERT TO authenticated 
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);
-- EXPLICIT OMISSION: NO UPDATE OR DELETE POLICIES ALLOWED (Immutability Enforced)

-- Security Events Policies
CREATE POLICY "Allow superadmin read security_events" ON public.security_events 
FOR SELECT TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Allow superadmin insert security_events" ON public.security_events 
FOR INSERT TO authenticated 
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);
-- EXPLICIT OMISSION: NO UPDATE OR DELETE POLICIES ALLOWED

-- Parent-Student Mapping Policies
CREATE POLICY "Allow admin read parent_student_map" ON public.parent_student_map 
FOR SELECT TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'principal'))
);
CREATE POLICY "Allow parents read own mapping" ON public.parent_student_map 
FOR SELECT TO authenticated 
USING (parent_id = auth.uid());
CREATE POLICY "Allow admin insert parent_student_map" ON public.parent_student_map 
FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));
CREATE POLICY "Allow admin update parent_student_map" ON public.parent_student_map 
FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));
CREATE POLICY "Allow admin delete parent_student_map" ON public.parent_student_map 
FOR DELETE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));
