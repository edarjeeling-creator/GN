import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODE3Mzk3NDQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.xIsGjmpPMWwjAGBy-SFSNBkqEOFrg41JVZ6zRXT-0zo';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixSubodh() {
  console.log('Fetching users to find subodh...');
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error fetching users:", error);
    return;
  }
  
  const subodh = users.users.find(u => u.email === 'subodh@gyanodayniketan.cloud');
  console.log("Subodh user found in auth.users?:", subodh ? 'Yes' : 'No');
  
  if (subodh) {
    console.log("Subodh identities:", subodh.identities);
    if (!subodh.identities || subodh.identities.length === 0) {
      console.log("Subodh has no identities! This is the 'broken user' bug.");
      // We can try to recreate the user, or add an identity
      // Actually, deleting and recreating is what final_cleanup.sql did, but maybe not for Subodh if it wasn't run recently.
    }
  } else {
    console.log("Subodh not found. Creating...");
    const { data, error: createErr } = await supabase.auth.admin.createUser({
      email: 'subodh@gyanodayniketan.cloud',
      password: 'Password123!',
      email_confirm: true,
      user_metadata: {
        full_name: 'Subodh',
        role: 'teacher'
      }
    });
    console.log("Create result:", data, createErr);
  }
}

fixSubodh();
