import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://supabase.gyanodayniketan.cloud';
const supabaseKey = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function login() {
  console.log("Trying login with URL:", supabaseUrl);
  // first let's see if we can query some public data
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .select('*')
    .limit(1);
    
  console.log("Schools check:", school ? "OK" : schoolErr);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'urvashi_rumba@gyanodayniketan.cloud',
    password: 'Password123!'
  });
  
  if (error) {
    console.log("Login with Password123! failed:", error.message);
  } else {
    console.log("Login with Password123! succeeded! User ID:", data.user.id);
  }
}

login();
