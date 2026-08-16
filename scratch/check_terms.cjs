const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://grades.gyanodayniketan.cloud', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UiLAogICAgImlhdCI6IDE3MjMyOTI1ODksCiAgICAiZXhwIjogMjAzODg2ODU4OQp9.h8o2P4l4-W8P4P4P4P4P4P4P4P4P4P4P4P4P4P4P4P4');
// wait, I don't have the anon key. Let me use the pg client.
