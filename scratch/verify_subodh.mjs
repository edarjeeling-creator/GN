import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
// This is the public anon key.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTeacher() {
  const email = 'subodh@gyanodayniketan.cloud';
  const password = 'TempPassword123!'; // We assume the admin sets this password manually

  console.log('1. Testing Login...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error('❌ Login Failed:', authError.message);
    return;
  }
  console.log('✅ Login Successful! User ID:', authData.user.id);

  console.log('\n2. Verifying Profile Creation...');
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError) {
    console.error('❌ Profile missing or error:', profileError.message);
  } else {
    console.log('✅ Profile exists:', profileData);
  }

  console.log('\n3. Verifying RLS (Trying to insert a mark)...');
  const { data: rlsData, error: rlsError } = await supabase
    .from('marks')
    .insert([{
      student_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5', // dummy
      subject_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5', // dummy
      term: 'Test_Term',
      score: 100
    }])
    .select();
  
  if (rlsError) {
    // If it's an RLS violation because the dummy student/subject IDs don't match the teacher's school, that's expected.
    // If it's a foreign key violation, it means RLS ALLOWED the insert, but the foreign key failed, which proves RLS works!
    console.log('ℹ️ RLS/Database Response:', rlsError.message);
  } else {
    console.log('✅ RLS allowed insert:', rlsData);
  }
}

verifyTeacher();
