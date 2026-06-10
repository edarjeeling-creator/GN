-- 1. Create Feature Access Audit Logs Table
CREATE TABLE IF NOT EXISTS public.feature_access_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    feature_name TEXT NOT NULL,
    user_type TEXT NOT NULL, -- 'student', 'teacher', 'class'
    target_id UUID,
    target_name TEXT NOT NULL,
    action TEXT NOT NULL, -- 'Granted', 'Explicit Block', 'Revoked', 'Renewed', 'Expired', 'Bulk Granted', 'Bulk Revoked'
    expires_at TIMESTAMPTZ,
    reason TEXT,
    action_details JSONB,
    source TEXT DEFAULT 'Admin Dashboard',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.feature_access_audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Define Policies
-- Allow Superadmins, Admins, and Principals to SELECT
CREATE POLICY "Allow admin read feature_access_audit_logs" ON public.feature_access_audit_logs 
FOR SELECT TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'principal'))
);

-- Allow Superadmins and Admins to INSERT
CREATE POLICY "Allow admin insert feature_access_audit_logs" ON public.feature_access_audit_logs 
FOR INSERT TO authenticated 
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- NO UPDATE OR DELETE POLICIES ALLOWED (Immutability Enforced)
