import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function signupSubodh() {
  console.log('Signing up Subodh...');
  const { data, error } = await supabase.auth.signUp({
    email: 'subodh@gyanodayniketan.cloud',
    password: 'Subodh@123',
    options: {
      data: {
        name: 'Subodh',
        full_name: 'Subodh',
        role: 'admin'
      }
    }
  });

  if (error) {
    console.error('Signup Error:', error);
  } else {
    console.log('Signup Success:', data.user ? data.user.email : 'Check confirmation mail');
    
    // Check if we can login directly
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
      email: 'subodh@gyanodayniketan.cloud',
      password: 'Subodh@123'
    });
    
    if (loginErr) {
      console.log('Login after signup failed:', loginErr.message);
    } else {
      console.log('Login successful! User is confirmed.');
    }
  }
}

signupSubodh();
