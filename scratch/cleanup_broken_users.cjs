const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  // 1. Fetch broken profiles
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, name, role');
  if (pErr) throw pErr;

  const brokenUsers = profiles.filter(p => p.name.toLowerCase().includes('rajesh') || p.name.toLowerCase().includes('test') || p.name.toLowerCase().includes('subodh'));
  
  console.log('Found broken users in profiles:', brokenUsers);

  for (const user of brokenUsers) {
    console.log(`Deleting ${user.name} (${user.id})...`);
    
    // Delete from profiles (and other tables if needed)
    await supabase.from('lib_members').delete().eq('user_id', user.id);
    await supabase.from('profiles').delete().eq('id', user.id);

    // Delete from auth.users via admin API
    const { data, error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      console.log(`Failed to delete auth user ${user.id}:`, error.message);
    } else {
      console.log(`Successfully deleted auth user ${user.id}`);
    }
  }

  console.log('Done!');
}
run();
