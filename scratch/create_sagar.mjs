import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODE3Mzk3NDQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.xIsGjmpPMWwjAGBy-SFSNBkqEOFrg41JVZ6zRXT-0zo';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('Attempting to create sagar@gyanodayniketan.cloud...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'sagar@gyanodayniketan.cloud',
    password: 'password123',
    email_confirm: true,
    user_metadata: {
      full_name: 'Sagar Gurung',
      name: 'Sagar Gurung',
      role: 'teacher',
      school_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5'
    }
  });

  if (error) {
    console.error('ERROR:', error);
  } else {
    console.log('SUCCESS:', data.user.id);
  }
}
run();
