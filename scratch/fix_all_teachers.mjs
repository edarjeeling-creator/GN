import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  const { data: profiles, error: profileErr } = await supabase.from('profiles').select('*').eq('role', 'teacher');
  if (profileErr) {
    console.error("Error fetching profiles", profileErr);
    return;
  }
  
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error("Error fetching auth users", authErr);
    return;
  }
  
  const authUsers = authData.users;
  console.log(`Found ${profiles.length} teacher profiles.`);
  
  let brokenCount = 0;
  for (const p of profiles) {
    const authUser = authUsers.find(u => u.email === p.email);
    if (!authUser) {
      console.log(`Teacher ${p.email} (${p.name}) MISSING from auth.users!`);
      brokenCount++;
      
      // Let's create the auth user
      console.log(`Creating auth user for ${p.email}...`);
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: p.email,
        password: 'password123',
        email_confirm: true,
        user_metadata: {
          name: p.name,
          full_name: p.name,
          role: 'teacher',
          school_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5'
        }
      });
      if (createError) {
        console.error(`Failed to create ${p.email}:`, createError);
      } else {
        console.log(`Successfully created ${p.email}`);
      }
    } else {
      if (!authUser.identities || authUser.identities.length === 0) {
        console.log(`Teacher ${p.email} (${p.name}) has NO identities (broken login)!`);
        brokenCount++;
        // The fix is usually to recreate them or manually insert an identity via postgres, 
        // but creating them properly via API often requires deleting them first and recreating them.
        
        console.log(`Deleting broken user ${p.email}...`);
        await supabase.auth.admin.deleteUser(authUser.id);
        
        console.log(`Recreating auth user for ${p.email}...`);
        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
          email: p.email,
          password: 'password123',
          email_confirm: true,
          user_metadata: {
            name: p.name,
            full_name: p.name,
            role: 'teacher',
            school_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5'
          }
        });
        if (createError) {
          console.error(`Failed to recreate ${p.email}:`, createError);
        } else {
          console.log(`Successfully recreated ${p.email}`);
        }
      } else {
        // Just force the password to be correct so they can log in
        const { error: updateErr } = await supabase.auth.admin.updateUserById(
          authUser.id,
          { password: 'password123' }
        );
        if (updateErr) {
          console.error(`Failed to update password for ${p.email}:`, updateErr);
        } else {
          console.log(`Successfully updated password for ${p.email}`);
        }
      }
    }
  }
  console.log(`Total broken teachers processed: ${brokenCount}`);
}

run();
