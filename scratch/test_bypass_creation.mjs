import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
// Anon key is fine for calling this RPC, but we can use it.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createBypassUser() {
  console.log('Attempting to create user via RPC bypass...');
  const { data, error } = await supabase.rpc('admin_create_user_bypass', {
    p_email: 'test999@gyanodayniketan.cloud',
    p_password: 'Password123!',
    p_name: 'Test',
    p_role: 'teacher',
    p_department: 'Mathematics',
    p_employee_id: 'EMP999'
  });

  console.log('Creation Result:', data, error);

  if (data && data.success) {
    console.log('User created successfully! Now testing login...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test999@gyanodayniketan.cloud',
      password: 'Password123!'
    });

    if (authError) {
      console.error('❌ Login failed:', authError.message);
    } else {
      console.log('✅ Login SUCCESS!', authData.user.id);
      console.log('We completely bypassed the GoTrue bug and logged in successfully!');
    }
  }
}

createBypassUser();
