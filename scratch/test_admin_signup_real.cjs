const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODE3Mzk3NDQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.xIsGjmpPMWwjAGBy-SFSNBkqEOFrg41JVZ6zRXT-0zo';

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
