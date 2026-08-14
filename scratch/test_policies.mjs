import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(line => line.includes('=')).map(line => line.split('=')));

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'sagar@gyanodayniketan.cloud',
    password: 'password123'
  });
  const { data, error } = await supabase.rpc('run_sql', { query: "SELECT * FROM pg_policies WHERE tablename = 'conversations'" });
  if (error) {
     console.log("no rpc, trying raw query via terminal soon");
  } else {
     console.log(data);
  }
}
run();
