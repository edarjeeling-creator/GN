-- Migration for Calendar Events

-- 1. Add new columns to the existing events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS event_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 2. Ensure all existing legacy events are treated as all-day events
UPDATE events 
SET is_all_day = true 
WHERE is_all_day IS NULL;

-- 3. Set a default value for future insertions (if not provided)
ALTER TABLE events 
ALTER COLUMN is_all_day SET DEFAULT true;

-- 4. Set up Row Level Security (RLS) for the events table
-- Only authenticated users can read events
-- Only admins/teachers (depending on your role setup) can insert/update/delete
-- Assuming existing RLS might already exist, these are safe "IF NOT EXISTS" equivalent policies.
-- In Supabase, if a policy exists, creating it again will fail, so you may need to drop existing ones first.

-- Example security policies (adjust based on your existing roles):
-- CREATE POLICY "Anyone can view events" ON events FOR SELECT USING (true);
-- CREATE POLICY "Admins can manage events" ON events FOR ALL USING (
--   EXISTS (
--     SELECT 1 FROM profiles 
--     WHERE profiles.id = auth.uid() 
--     AND profiles.role = 'admin'
--   )
-- );
