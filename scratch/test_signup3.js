import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODE3Mzk3NDQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.xIsGjmpPMWwjAGBy-SFSNBkqEOFrg41JVZ6zRXT-0zo';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function test() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'sagar.admin@gyanodayniketan.cloud',
    password: 'password123',
    email_confirm: true,
    user_metadata: {
      name: 'Sagar Gurung',
      full_name: 'Sagar Gurung',
      role: 'teacher'
    }
  });
  console.log('Error:', error);
  if (error) {
    console.log('Error.message:', error.message);
  } else {
    console.log('Signup successful!', data);
  }
}
test();
