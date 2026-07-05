import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODE3Mzk3NDQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.xIsGjmpPMWwjAGBy-SFSNBkqEOFrg41JVZ6zRXT-0zo';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUser() {
  console.log('Attempting to create user...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'principal@gyanodayniketan.cloud',
    password: 'Password123!',
    email_confirm: true,
    user_metadata: {
      full_name: 'Super Admin',
      role: 'superadmin'
    }
  });

  if (error) {
    console.error('FAILED TO CREATE USER:', error.message, error.status, error.name);
  } else {
    console.log('SUCCESS! User created:', data.user.email);
  }
}

createUser();
