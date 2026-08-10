import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSignup() {
  const email = `test_teacher_${Date.now()}@gyanodayniketan.cloud`;
  console.log(`Attempting to sign up ${email}...`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'Password123!',
    options: {
      data: {
        name: 'Test Teacher',
        role: 'teacher'
      }
    }
  });

  if (error) {
    console.error('Signup Error:', error.message, error.status);
    console.log('Error object:', JSON.stringify(error, null, 2));
  } else {
    console.log('Signup Success!', data.user.id);
  }
}

testSignup();
