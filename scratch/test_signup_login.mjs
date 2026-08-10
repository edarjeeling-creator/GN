import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
// use anon key for login
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.v9V-H1jC_uN4YI1V816ZlBps9-x7B6a2KkY1f618N5s';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const supabaseAnon = createClient(supabaseUrl, anonKey);

async function run() {
  const email = 'test_teacher_2000@gyanodayniketan.cloud';
  const password = 'Password123!';
  
  console.log('1. Creating teacher...');
  const { data, error } = await supabaseAdmin.rpc('create_teacher_bypass', {
    p_email: email,
    p_password: password,
    p_name: 'Test Teacher 2000',
    p_school_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5'
  });
  
  if (error) {
    console.error('Create error:', error);
    return;
  }
  console.log('Created successfully:', data);

  console.log('2. Attempting to log in...');
  const { data: loginData, error: loginErr } = await supabaseAnon.auth.signInWithPassword({
    email,
    password
  });
  
  if (loginErr) {
    console.error('Login error:', loginErr.message);
  } else {
    console.log('Login successful!', loginData.user.id);
  }
}
run();
