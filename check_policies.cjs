const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.rpc('get_policies'); // won't work
  
  // Just use pure REST on pg_policies?
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "SELECT * FROM pg_policies WHERE tablename = 'student_notifications'" })
  });
  console.log(await res.text());
}

test();
