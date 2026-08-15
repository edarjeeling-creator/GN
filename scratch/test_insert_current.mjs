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
  
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
  
  const { data, error } = await supabase.from('conversations').insert({
    id: '123e4567-e89b-12d3-a456-426614174005',
    type: 'direct',
    title: null,
    school_id: profile.school_id,
    created_by: profile.id
  });
  console.log("Insert Data:", data);
  console.log("Insert Error:", error);
}
test();
