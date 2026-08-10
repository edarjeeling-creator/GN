import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file manually or just parse it
const envContent = fs.readFileSync(path.resolve('.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Query pg_proc via a custom RPC if possible, or just call a non-existent one to see error
  // Actually, we can't easily query pg_proc via anon key.
  // We can try to call 'submit_id_form' and see the exact error.
  const { data, error } = await supabase.rpc('submit_id_form', { p_token: '123', p_data: {} });
  console.log("submit_id_form result:", error ? error.message : data);
}

main();
