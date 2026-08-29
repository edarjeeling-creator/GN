-- We use a BEFORE INSERT trigger with a transaction-level advisory lock
-- to ensure that concurrent inserts for the same person are serialized.
-- This prevents race conditions where two transactions both read COUNT(*) = 0.

CREATE OR REPLACE FUNCTION check_attendance_duplicate()
RETURNS TRIGGER AS $$
DECLARE
  v_duplicate_count INT;
BEGIN
  -- Obtain a transaction-level advisory lock for this person
  -- First argument is a namespace hash, second is the person_id hash
  PERFORM pg_advisory_xact_lock(hashtext('attendance_logs_duplicate_check'), hashtext(NEW.person_id::text));

  -- Now we can safely check for recent duplicates
  -- The lock ensures any concurrent transaction inserting for this person
  -- will wait, and then see the committed insert from this transaction.
  SELECT COUNT(*) INTO v_duplicate_count
  FROM public.attendance_logs
  WHERE person_id = NEW.person_id
    AND status != 'Cancelled'
    AND scan_time >= (NEW.scan_time - INTERVAL '3 minutes')
    AND scan_time <= (NEW.scan_time + INTERVAL '3 minutes');

  IF v_duplicate_count > 0 THEN
    -- Raise standard unique_violation (23505) so the frontend/API 
    -- can handle it robustly without relying on string matching.
    RAISE EXCEPTION 'DUPLICATE' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_attendance_duplicate ON public.attendance_logs;

CREATE TRIGGER trg_check_attendance_duplicate
BEFORE INSERT ON public.attendance_logs
FOR EACH ROW
EXECUTE FUNCTION check_attendance_duplicate();
