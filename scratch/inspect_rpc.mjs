import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://grades.gyanodayniketan.cloud'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'
const supabase = createClient(supabaseUrl, supabaseKey)

async function inspect() {
  try {
    const { data: email, error } = await supabase.rpc('lookup_teacher_email_by_name', { p_name: 'Sagar' });
    console.log("RPC result for Sagar:", email, error);
    
    // Also try another known user
    const { data: email2 } = await supabase.rpc('lookup_teacher_email_by_name', { p_name: 'Admin' });
    console.log("RPC result for Admin:", email2);
  } catch (err) {
    console.error("Error inspecting database:", err);
  }
}

inspect();
