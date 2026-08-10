const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  
  const brokenUsers = users.filter(u => 
    u.email.includes('subodh') || 
    u.email.includes('rajesh') || 
    u.email.includes('test')
  );

  console.log(`Found ${brokenUsers.length} broken users in auth.users`);

  for (const user of brokenUsers) {
    console.log(`Attempting to delete ${user.email} (${user.id})...`);
    
    // First ensure they are deleted from dependent tables just in case
    await supabase.from('lib_members').delete().eq('user_id', user.id);
    await supabase.from('profiles').delete().eq('id', user.id);
    
    const { data, error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.log(`Failed to delete auth user ${user.id}:`, delErr.message, JSON.stringify(delErr));
    } else {
      console.log(`Successfully deleted auth user ${user.id}`);
    }
  }
}
run();
