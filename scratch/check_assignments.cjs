const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://grades.gyanodayniketan.cloud', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE');

async function run() {
  const { data, error } = await supabase.from('assignments').select('*').limit(1);
  console.log("Assignments data:", data);
  console.log("Assignments error:", error);
  
  // Also let's check students
  const { data: d2, error: e2 } = await supabase.from('students').select('*').limit(1);
  console.log("Student:", d2);
  
  // also check what relation exists for students
  const { data: d3, error: e3 } = await supabase.from('assignments').select('*, students(*)').limit(1);
  console.log("Relation test (students):", e3 ? e3.message : "success");
  
  const { data: d4, error: e4 } = await supabase.from('assignments').select('*, profiles(*)').limit(1);
  console.log("Relation test (profiles):", e4 ? e4.message : "success");
}
run();
