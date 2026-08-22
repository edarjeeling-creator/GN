const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://grades.gyanodayniketan.cloud', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'
);

async function check() {
  const { data, error } = await supabase.rpc('get_student_report', { 
    p_uid: '669528',
    p_academic_year: '2026'
  });
  
  console.log("Error:", error);
  console.log("Data keys:", data ? Object.keys(data) : 'no data');
}

check();
