import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.auth.signUp({
    email: 'sagar.test3@gyanodayniketan.cloud',
    password: 'password123',
    options: {
      data: {
        name: 'Sagar Gurung',
        full_name: 'Sagar Gurung',
        role: 'teacher',
        school_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5'
      }
    }
  });
  console.log('Error:', error);
  if (error) {
    console.log('Error.message:', error.message);
  } else {
    console.log('Signup successful!', data);
  }
}
test();
