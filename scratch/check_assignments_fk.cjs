const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('assignments').select('*, students(*)').limit(1);
  console.log("With students(*):", error ? error.message : "Success");
  
  const { data: d2, error: e2 } = await supabase.from('assignments').select('*, profiles(*)').limit(1);
  console.log("With profiles(*):", e2 ? e2.message : "Success");
}
check();
