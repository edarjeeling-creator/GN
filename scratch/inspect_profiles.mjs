import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://grades.gyanodayniketan.cloud'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'
const supabase = createClient(supabaseUrl, supabaseKey)

async function inspect() {
  try {
    console.log("Fetching profiles...");
    const { data: profiles, error } = await supabase.from('profiles').select('*');
    if (error) {
      console.error("Profiles fetch error:", error);
      return;
    }
    console.log("\n--- Faculty/Admin Profiles ---");
    console.log(profiles.map(p => `${p.name} - ${p.role}`).join('\n'));
    
    // Check if sagar is there
    const sagar = profiles.find(p => p.name.toLowerCase().includes('sagar'));
    if (sagar) {
        console.log("Found Sagar:", sagar);
    } else {
        console.log("Sagar not found in profiles");
    }
  } catch (err) {
    console.error("Error inspecting database:", err);
  }
}

inspect();
