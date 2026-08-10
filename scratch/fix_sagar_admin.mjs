import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function run() {
  const targetEmail = 'sagar@gyanodayniketan.cloud';
  
  console.log("Creating user properly with admin.createUser...");
  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email: targetEmail,
    password: 'password123',
    email_confirm: true, // This bypasses the email confirmation requirement
    user_metadata: {
      name: 'Sagar Gurung',
      full_name: 'Sagar Gurung',
      role: 'teacher',
      school_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5'
    }
  });

  if (createError) {
    console.error("Error creating user:", createError);
  } else {
    console.log("User created successfully!", createData.user.id);
    
    // Check if profile was created by the trigger
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', createData.user.id).single();
    if (profileData) {
      console.log("Profile verified in public.profiles!");
    } else {
      console.log("Warning: Profile not found. The handle_new_user trigger might have failed.");
    }
  }
}

run()
