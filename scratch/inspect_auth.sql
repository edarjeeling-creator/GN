-- Create RPC to inspect auth.users
CREATE OR REPLACE FUNCTION inspect_auth_users()
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(u) INTO v_result FROM auth.users u ORDER BY created_at DESC LIMIT 5;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
