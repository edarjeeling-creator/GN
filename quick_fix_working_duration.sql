-- ==============================================================================
-- QUICK FIX FOR: column "working_duration_seconds" of relation "teacher_attendance" does not exist
-- Run this in Supabase Studio -> SQL Editor -> Click "Run"
-- ==============================================================================

ALTER TABLE public.teacher_attendance 
  ADD COLUMN IF NOT EXISTS working_hours TEXT,
  ADD COLUMN IF NOT EXISTS working_duration_seconds DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS check_in_method TEXT DEFAULT 'DIRECT',
  ADD COLUMN IF NOT EXISTS check_out_method TEXT DEFAULT 'DYNAMIC_QR',
  ADD COLUMN IF NOT EXISTS check_in_verification_status TEXT DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS check_out_verification_status TEXT DEFAULT 'VERIFIED',
  ADD COLUMN IF NOT EXISTS check_in_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_in_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_out_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_out_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_in_distance_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_out_distance_meters DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_in_qr_session_id UUID,
  ADD COLUMN IF NOT EXISTS check_out_qr_session_id UUID,
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.campuses(id),
  ADD COLUMN IF NOT EXISTS kiosk_id UUID REFERENCES public.attendance_kiosks(id),
  ADD COLUMN IF NOT EXISTS gps_accuracy DOUBLE PRECISION;
