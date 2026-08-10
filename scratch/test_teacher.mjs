import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.rpc('create_teacher_bypass', {
    p_email: 'teacher@gyanodayniketan.cloud',
    p_password: 'password123',
    p_name: 'Sagar Gurung',
    p_school_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5'
  })
  console.log("Create Data:", data);
  if (error) console.log("Create Error:", error);

  // Now try to log in
  const res = await supabase.auth.signInWithPassword({
    email: 'teacher@gyanodayniketan.cloud',
    password: 'password123'
  })
  if (res.error) {
    console.log("Error logging in:", res.error.message);
  } else {
    console.log("Logged in successfully!", res.data.user.email);
  }
}

run()
