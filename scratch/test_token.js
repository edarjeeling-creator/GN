import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('generate_form_token', { p_user_id: '00000000-0000-0000-0000-000000000000', p_role: 'student' });
  console.log("Generate token:", data, error?.message);
  
  if (data) {
    const { data: vData, error: vError } = await supabase.rpc('validate_form_token', { p_token: data });
    console.log("Validate token:", vData, vError?.message);
  }
}
check();
