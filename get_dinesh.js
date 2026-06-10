const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: student } = await supabase.from('students').select('*').ilike('name', '%dinesh%');
    console.log("Student table:", student);
    
    const { data: profile } = await supabase.from('profiles').select('*').ilike('name', '%dinesh%');
    console.log("Profile table:", profile);
}
run();
