import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSagar() {
  console.log("Checking profiles for name sagar...");
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('name', '%sagar%');
    
  if (error) {
    console.error("Error fetching from profiles:", error);
  } else {
    console.log("Found in profiles:", profile);
  }
}

checkSagar();
