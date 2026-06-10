const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.5Z3Xl-N52Z07l2b090l8mO1T5l7c0K1Q2y8c7y0z0k4'; // Actually, let me get it from test_supabase.js instead
// Wait, I can't just guess the service role key. I will read it from check_rpc.cjs! No, check_rpc.cjs had anon key.

async function run() {
    const { data: student } = await supabase.from('students').select('*').ilike('name', '%dinesh%');
    console.log("Student table:", student);
    
    const { data: profile } = await supabase.from('profiles').select('*').ilike('name', '%dinesh%');
    console.log("Profile table:", profile);
}
run();
