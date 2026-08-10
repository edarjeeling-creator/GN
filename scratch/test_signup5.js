import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.auth.signUp({
    email: 'test_trigger123@gyanodayniketan.cloud',
    password: 'password123',
    options: {
      data: {
        name: 'Test Trigger',
        full_name: 'Test Trigger',
        role: 'teacher',
        school_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5'
      }
    }
  });
  console.log('Error object:', error);
  if (error) {
    console.log('Error stringified:', JSON.stringify(error, null, 2));
    console.log('Error properties:', Object.keys(error));
    if (error.stack) console.log('Stack:', error.stack);
  }
}
test();
