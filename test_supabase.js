import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://supabase.gyanodayniketan.cloud'
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDatabase() {
  console.log("Checking profiles...");
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, name, role, school_id');
  console.log("Profiles:", profiles);
  if (pErr) console.error("Profile Error:", pErr);

  console.log("Checking students...");
  const { data: students, error: sErr } = await supabase.from('students').select('id, name, uid, school_id');
  console.log("Students:", students);
  if (sErr) console.error("Student Error:", sErr);
  
  console.log("Checking RPC...");
  const { data: rpc, error: rpcErr } = await supabase.rpc('lookup_teacher_email_by_name', { p_name: 'Manju Singh' });
  console.log("RPC result:", rpc);
  if (rpcErr) console.error("RPC Error:", rpcErr);
}

checkDatabase();
