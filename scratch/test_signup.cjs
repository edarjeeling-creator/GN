const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/nodiappu/GN/.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.auth.signUp({
    email: 'test_teacher_abc1234@gyanodayniketan.cloud',
    password: 'password123',
    options: {
      data: {
        name: 'Test Teacher',
        full_name: 'Test Teacher',
        role: 'teacher'
      }
    }
  });
  console.log("Data:", data);
  console.log("Error:", error);
}

test();
