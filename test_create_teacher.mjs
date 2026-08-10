import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./subodh.json', 'utf-8'));
const supabaseUrl = config.supabaseUrl;
const supabaseKey = config.supabaseServiceKey; // Try with service key or whatever is in subodh.json

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.rpc('create_teacher_bypass', {
    p_email: 'urvashi@gyanodayniketan.cloud',
    p_password: 'Password123!',
    p_name: 'Urvashi Rumba',
    p_school_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5'
  });
  console.log('Result:', data);
  if (error) console.error('Error:', error);
}

test();
