-- ==============================================================================
-- Migration: delete_notices_migration.sql
-- Run this in Supabase Studio SQL Editor to ensure RLS & RPC are up to date
-- ==============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notices') THEN
    ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow admin manage notices" ON public.notices;
    DROP POLICY IF EXISTS "Allow admin and author delete notices" ON public.notices;

    -- Policy allowing admin, principal, and notice creator to manage (INSERT, UPDATE, DELETE) notices
    CREATE POLICY "Allow admin manage notices"
      ON public.notices FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'principal', 'superadmin')
        )
        OR sender_uid = auth.uid()
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'principal', 'superadmin')
        )
        OR sender_uid = auth.uid()
      );
  END IF;
END $$;

-- Security Definer RPC for reliable notice deletion
CREATE OR REPLACE FUNCTION public.delete_school_notice(p_notice_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_sender_uid UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
  SELECT sender_uid INTO v_sender_uid FROM public.notices WHERE id = p_notice_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_role IN ('admin', 'principal', 'superadmin') OR v_sender_uid = v_user_id THEN
    DELETE FROM public.notices WHERE id = p_notice_id;
    RETURN TRUE;
  ELSE
    RAISE EXCEPTION 'Unauthorized: only principal, admin, or the notice author can delete this notice';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_school_notice(UUID) TO authenticated;
