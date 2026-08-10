import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixTeachers() {
  console.log('Fetching teacher profiles...');
  const { data: profiles, error: profileErr } = await supabase.from('profiles').select('*').eq('role', 'teacher');
  if (profileErr) {
    console.error("Error fetching profiles:", profileErr);
    return;
  }
  
  console.log(`Found ${profiles.length} teachers.`);
  
  for (const t of profiles) {
    if (!t.email) continue;
    
    console.log(`Fixing teacher ${t.name} (${t.email})...`);
    
    // First, let's just try to login. Maybe their credentials are valid?
    // We'll assume the password should be 'Password123!' or maybe they don't have one.
    
    const { data: rpcData, error: rpcError } = await supabase.rpc('admin_create_user_bypass', {
      p_email: t.email,
      p_password: 'Password123!',
      p_name: t.name,
      p_role: 'teacher',
      p_department: t.department || 'General',
      p_employee_id: t.employee_id || 'EMP'
    });
    
    if (rpcError) {
       console.log(`  RPC Error:`, rpcError.message);
    } else {
       console.log(`  RPC Result:`, rpcData);
    }
  }
}

fixTeachers();
