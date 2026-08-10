import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, anonKey)

async function run() {
  const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'principal@gyanodayniketan.cloud',
    password: 'Password123!'
  });
  
  if (loginError) {
    console.error("Login Error:", loginError);
    return;
  }
  
  console.log("Logged in!");
  
  const newAssignment = { 
    teacher_id: 'bca2d46e-18a9-4484-8baa-ac441f267cf9', // Sagar
    class_id: '0b3e3144-13b2-4582-84b3-84a228d42aab', // 5 A
    subject_id: 'd64bfa90-abd5-425e-a23b-678038c93ebe', // Math
    school_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5'
  };
  
  try {
    const { data, error } = await supabase.from('teacher_subjects').upsert([newAssignment], { onConflict: 'teacher_id,class_id,subject_id' }).select();
    if (error) {
        console.error("Supabase Client Error:", error);
    } else {
        console.log("Success:", data);
    }
  } catch (e) {
    console.error("Caught exception:", e.message);
  }
}
run()
