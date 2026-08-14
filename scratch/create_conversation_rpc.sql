CREATE OR REPLACE FUNCTION public.create_direct_conversation(
  p_other_user_id UUID,
  p_title TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv_id UUID;
  v_school_id UUID;
  v_my_id UUID;
BEGIN
  -- Get the caller's profile ID
  v_my_id := auth.uid();
  
  -- Get the caller's school ID
  SELECT school_id INTO v_school_id
  FROM public.profiles
  WHERE id = v_my_id;
  
  -- Prevent creating conversations if caller has no profile
  IF v_school_id IS NULL THEN
    v_school_id := '00000000-0000-0000-0000-000000000000'::UUID;
  END IF;

  -- Generate new UUID for conversation
  v_conv_id := gen_random_uuid();

  -- Insert conversation
  INSERT INTO public.conversations (id, type, title, school_id, created_by)
  VALUES (v_conv_id, 'direct', p_title, v_school_id, v_my_id);

  -- Insert members
  INSERT INTO public.conversation_members (conversation_id, profile_id, role)
  VALUES 
    (v_conv_id, v_my_id, 'admin'),
    (v_conv_id, p_other_user_id, 'member');

  RETURN v_conv_id;
END;
$$;
