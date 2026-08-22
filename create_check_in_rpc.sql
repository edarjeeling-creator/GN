CREATE OR REPLACE FUNCTION public.check_in_teacher(p_device_info text)
RETURNS public.teacher_attendance
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_teacher_id uuid;
    v_today date;
    v_record public.teacher_attendance;
BEGIN
    v_teacher_id := auth.uid();
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_today := current_date;

    SELECT * INTO v_record FROM public.teacher_attendance
    WHERE teacher_id = v_teacher_id AND attendance_date = v_today;

    IF v_record.id IS NOT NULL THEN
        RETURN v_record;
    END IF;

    -- Insert new check-in record. Since reporting time is open, we mark as Present.
    INSERT INTO public.teacher_attendance (teacher_id, attendance_date, status, check_in_time)
    VALUES (v_teacher_id, v_today, 'Present', NOW())
    RETURNING * INTO v_record;

    RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_out_teacher()
RETURNS public.teacher_attendance
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_teacher_id uuid;
    v_today date;
    v_record public.teacher_attendance;
BEGIN
    v_teacher_id := auth.uid();
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_today := current_date;

    UPDATE public.teacher_attendance
    SET check_out_time = NOW()
    WHERE teacher_id = v_teacher_id AND attendance_date = v_today
    RETURNING * INTO v_record;

    IF v_record.id IS NULL THEN
        RAISE EXCEPTION 'No check-in record found for today';
    END IF;

    RETURN v_record;
END;
$$;
