const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
// Anon key doesn't have privileges to run migrations
// Wait, I can't run this without the service role key!
