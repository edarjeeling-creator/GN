import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Signing up...");
  try {
    const res = await supabase.auth.signUp({
      email: 'test_signup_new_test_123@gyanodayniketan.cloud',
      password: 'password123',
      options: {
        data: {
          name: 'Test Name',
          full_name: 'Test Name',
          role: 'teacher',
          school_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5'
        }
      }
    });
    console.log("Data:", res.data);
    console.log("Error:", res.error);
    if (res.error) {
      console.log("Error message:", res.error.message);
      console.log("Error status:", res.error.status);
      console.log("Error name:", res.error.name);
    }
  } catch (err) {
    console.log("Caught Exception:", err);
  }
}
test();
