import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function run() {
  const { data: profiles, error } = await supabase.from('profiles').select('*');
  
  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }
  
  for (const profile of profiles) {
    console.log(`Deleting user ID from auth.users: ${profile.id} (${profile.name})`);
    if (profile.role === 'teacher' || profile.role === 'superadmin') {
       if (profile.role !== 'superadmin') {
         console.log("Deleting...", profile.id);
         const { error: delError } = await supabase.auth.admin.deleteUser(profile.id);
         if (delError) console.log("Delete error:", delError);
         else console.log("Deleted auth user successfully");
       }
    }
  }
}

run()
