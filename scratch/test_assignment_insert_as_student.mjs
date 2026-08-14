import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
const supabase = createClient(supabaseUrl, anonKey);

async function test() {
  const email = 'teststudent_' + Date.now() + '@example.com';
  const pass = 'password123';
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email, password: pass, options: { data: { role: 'student', full_name: 'Test Student' } }
  });
  if (authError) return console.error("signup error:", authError);
  
  console.log("student id:", authData.user.id);
  
  // try inserting assignment
  const { data: insertData, error: insertError } = await supabase.from('assignments').insert([{
    student_uid: authData.user.id,
    subject: 'AI',
    title: 'Test',
    file_url: 'test'
  }]);
  
  console.log("insert res:", insertData, insertError);
}
test();
