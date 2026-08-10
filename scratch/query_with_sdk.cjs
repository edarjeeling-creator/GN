const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const lines = envFile.split('\n');
let url = '';
let key = '';
for (const line of lines) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function run() {
  console.log('--- public.profiles ---');
  const { data: profData, error: profErr } = await supabase.from('profiles').select('*').limit(10);
  if (profErr) console.error(profErr);
  else console.log(profData);
  
  console.log('--- Attempt create_teacher_bypass ---');
  const { data: createData, error: createErr } = await supabase.rpc('create_teacher_bypass', {
    p_email: 'test_create@gyanodayniketan.cloud',
    p_password: 'Password123!',
    p_name: 'Test Create',
    p_school_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5'
  });
  console.log('Result:', createData);
  if (createErr) console.error('Error:', createErr);
}

run();
