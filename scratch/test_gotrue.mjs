import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testGoTrueAlive() {
  console.log('Testing GoTrue ping with fake admin login...');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin_fake@gyanodayniketan.cloud',
    password: 'wrong_password'
  });

  console.log('Login Response:', error ? error.status || error.name : 'Success');
}

testGoTrueAlive();
