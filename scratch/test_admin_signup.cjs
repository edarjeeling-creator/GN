const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/nodiappu/GN/.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.5Z3Xl-N52Z07l2b090l8mO1T5l7c0K1Q2y8c7y0z0k4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'test_admin_teacher123@gyanodayniketan.cloud',
    password: 'password123',
    email_confirm: true,
    user_metadata: {
      name: 'Test Teacher Admin',
      full_name: 'Test Teacher Admin',
      role: 'teacher'
    }
  });
  console.log("Data:", data);
  console.log("Error:", error);
}

test();
