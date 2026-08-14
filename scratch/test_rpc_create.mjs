import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(line => line.includes('=')).map(line => line.split('=')));

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'sagar@gyanodayniketan.cloud',
    password: 'password123'
  });
  if (authErr) throw authErr;
  
  const { data, error } = await supabase.rpc('create_direct_conversation', {
    p_other_user_id: authData.user.id, // using self just for testing
    p_title: null
  });
  console.log("Error:", error);
  console.log("Data:", data);
}

test();
