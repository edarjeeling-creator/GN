import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSubodh() {
  console.log('Testing RPC Bypass for subodh@gyanodayniketan.cloud...');
  
  // Try to create Subodh!
  const { data, error } = await supabase.rpc('admin_create_user_bypass', {
    p_email: 'subodh@gyanodayniketan.cloud',
    p_password: 'Password123!',
    p_name: 'Subodh',
    p_role: 'teacher',
    p_department: 'Mathematics',
    p_employee_id: 'EMP111'
  });

  console.log('Bypass Response:', data, error);

  if (data && data.success) {
    console.log('✅ Bypassed successfully! User ID:', data.user_id);
    
    // Test Login
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
      email: 'subodh@gyanodayniketan.cloud',
      password: 'Password123!'
    });
    
    if (loginErr) {
      console.error('❌ Login Error:', loginErr.message);
    } else {
      console.log('✅ LOGIN SUCCESSFUL!', loginData.user.id);
    }
  } else if (data && data.error === 'Email already exists') {
    console.log('Email exists in auth.users. Now testing login...');
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
      email: 'subodh@gyanodayniketan.cloud',
      password: 'Password123!'
    });
    
    if (loginErr) {
      console.error('❌ Login Error:', loginErr.message);
    } else {
      console.log('✅ LOGIN SUCCESSFUL with existing account!', loginData.user.id);
    }
  }
}

testSubodh();
