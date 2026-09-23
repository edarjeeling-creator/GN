-- ==============================================================================
-- Migration: 20260923_notice_push_and_device_security.sql
-- Enables RLS security on user_devices, creates server-authoritative notice
-- publishing RPC with recipient resolution, and secure FCM token resolution.
-- ==============================================================================

-- 1. HARDEN ROW-LEVEL SECURITY ON user_devices
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_devices') THEN
    ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can only read own devices" ON public.user_devices;
    DROP POLICY IF EXISTS "Users can only insert own devices" ON public.user_devices;
    DROP POLICY IF EXISTS "Users can only update own devices" ON public.user_devices;
    DROP POLICY IF EXISTS "Users can only delete own devices" ON public.user_devices;
    DROP POLICY IF EXISTS "Allow all for authenticated on user_devices" ON public.user_devices;
    DROP POLICY IF EXISTS "Allow all for anon on user_devices" ON public.user_devices;

    -- Authenticated users can only read, insert, update, delete their own device rows
    CREATE POLICY "Users can only read own devices"
      ON public.user_devices FOR SELECT
      TO authenticated
      USING (profile_id = auth.uid());

    CREATE POLICY "Users can only insert own devices"
      ON public.user_devices FOR INSERT
      TO authenticated
      WITH CHECK (profile_id = auth.uid());

    CREATE POLICY "Users can only update own devices"
      ON public.user_devices FOR UPDATE
      TO authenticated
      USING (profile_id = auth.uid())
      WITH CHECK (profile_id = auth.uid());

    CREATE POLICY "Users can only delete own devices"
      ON public.user_devices FOR DELETE
      TO authenticated
      USING (profile_id = auth.uid());
  END IF;
END $$;


-- 2. SERVER-AUTHORITATIVE NOTICE PUBLISHING & RECIPIENT RESOLUTION RPC
CREATE OR REPLACE FUNCTION public.publish_school_notice(
  p_title TEXT,
  p_content TEXT,
  p_target_audience TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_notice_id UUID;
  v_recipients UUID[];
  v_clean_body TEXT;
  v_school_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_caller_profile FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_profile.role NOT IN ('admin', 'principal', 'superadmin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only Principal or Administrator can publish school notices.';
  END IF;

  v_school_id := v_caller_profile.school_id;

  -- Clean preview body for notification message (strip HTML tags)
  v_clean_body := regexp_replace(COALESCE(p_content, ''), '<[^>]*>', '', 'g');
  v_clean_body := trim(v_clean_body);
  IF length(v_clean_body) > 120 THEN
    v_clean_body := substring(v_clean_body from 1 for 117) || '...';
  END IF;
  IF v_clean_body = '' THEN
    v_clean_body := 'New notice: ' || p_title;
  END IF;

  -- 1. Insert into notices table
  INSERT INTO public.notices (
    title,
    content,
    target_audience,
    sender_uid,
    publish_date,
    created_at
  ) VALUES (
    p_title,
    p_content,
    p_target_audience,
    v_caller_id,
    NOW(),
    NOW()
  ) RETURNING id INTO v_notice_id;

  -- 2. Resolve recipient user IDs server-side
  IF p_target_audience = 'all' THEN
    SELECT array_agg(id) INTO v_recipients 
    FROM public.profiles 
    WHERE status IS NULL OR status = 'Active';
  ELSIF p_target_audience = 'staff' THEN
    SELECT array_agg(id) INTO v_recipients 
    FROM public.profiles 
    WHERE role IN ('teacher', 'non_teaching', 'group_d', 'admin', 'principal', 'coordinator', 'accountant', 'librarian')
      AND (status IS NULL OR status = 'Active');
  ELSIF p_target_audience = 'teachers' THEN
    SELECT array_agg(id) INTO v_recipients 
    FROM public.profiles 
    WHERE (role IN ('teacher', 'coordinator') OR COALESCE(designation, '') ILIKE '%coordinator%')
      AND (status IS NULL OR status = 'Active');
  ELSIF p_target_audience = 'non_teaching' THEN
    SELECT array_agg(id) INTO v_recipients 
    FROM public.profiles 
    WHERE role IN ('non_teaching', 'accountant', 'librarian')
      AND (status IS NULL OR status = 'Active');
  ELSIF p_target_audience = 'group_d' THEN
    SELECT array_agg(id) INTO v_recipients 
    FROM public.profiles 
    WHERE role = 'group_d'
      AND (status IS NULL OR status = 'Active');
  ELSIF p_target_audience = 'students' THEN
    SELECT array_agg(id) INTO v_recipients 
    FROM public.profiles 
    WHERE role = 'student'
      AND (status IS NULL OR status = 'Active');
  ELSIF p_target_audience LIKE 'class:%' THEN
    DECLARE
      v_class_id UUID;
    BEGIN
      v_class_id := substring(p_target_audience from 7)::UUID;
      -- Include teachers assigned to this class + class teacher
      SELECT array_agg(DISTINCT u_id) INTO v_recipients FROM (
        SELECT teacher_id as u_id FROM public.teacher_subjects WHERE class_id = v_class_id AND teacher_id IS NOT NULL
        UNION
        SELECT class_teacher_id as u_id FROM public.classes WHERE id = v_class_id AND class_teacher_id IS NOT NULL
      ) t;
    EXCEPTION WHEN OTHERS THEN
      v_recipients := ARRAY[]::UUID[];
    END;
  ELSE
    SELECT array_agg(id) INTO v_recipients FROM public.profiles WHERE role = 'teacher' AND (status IS NULL OR status = 'Active');
  END IF;

  -- 3. Bulk insert into notifications table (In-App notifications for all target users)
  IF v_recipients IS NOT NULL AND array_length(v_recipients, 1) > 0 THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      school_id,
      is_read,
      created_at
    )
    SELECT 
      recip_id,
      p_title,
      v_clean_body,
      'notice',
      v_school_id,
      FALSE,
      NOW()
    FROM unnest(v_recipients) AS recip_id
    WHERE recip_id IS NOT NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'noticeId', v_notice_id,
    'recipientCount', COALESCE(array_length(v_recipients, 1), 0),
    'recipientUserIds', COALESCE(to_jsonb(v_recipients), '[]'::jsonb),
    'cleanBody', v_clean_body
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_school_notice(TEXT, TEXT, TEXT) TO authenticated;


-- 3. SECURE RECIPIENT FCM TOKEN RESOLUTION RPC
CREATE OR REPLACE FUNCTION public.get_recipient_fcm_tokens(p_recipient_ids UUID[])
RETURNS TABLE (
  profile_id UUID,
  fcm_token TEXT,
  platform TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  RETURN QUERY
  SELECT 
    ud.profile_id,
    ud.fcm_token,
    ud.platform
  FROM public.user_devices ud
  WHERE ud.profile_id = ANY(p_recipient_ids)
    AND ud.is_active = TRUE
    AND ud.fcm_token IS NOT NULL
    AND ud.fcm_token != '';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recipient_fcm_tokens(UUID[]) TO authenticated;


-- 4. FCM DEAD/EXPIRED TOKEN CLEANUP RPC
CREATE OR REPLACE FUNCTION public.deactivate_fcm_tokens(p_tokens TEXT[])
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  UPDATE public.user_devices
  SET is_active = FALSE, updated_at = NOW()
  WHERE fcm_token = ANY(p_tokens);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deactivate_fcm_tokens(TEXT[]) TO authenticated;
