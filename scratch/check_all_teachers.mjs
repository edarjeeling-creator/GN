import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODE3Mzk3NDQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.xIsGjmpPMWwjAGBy-SFSNBkqEOFrg41JVZ6zRXT-0zo'; // From fix_subodh_identity.mjs

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkTeachers() {
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
    } else {
      if (!authUser.identities || authUser.identities.length === 0) {
        console.log(`Teacher ${p.email} (${p.name}) has NO identities (broken login)!`);
        brokenCount++;
      } else {
        // console.log(`Teacher ${p.email} is OK.`);
      }
    }
  }
  console.log(`Total broken teachers: ${brokenCount}`);
}

checkTeachers();
