const { createClient } = require('@supabase/supabase-js');
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabase = createClient(supabaseUrl, anonKey);

async function test() {
  const { data, error } = await supabase.storage.from('public-assets').upload('test.txt', 'hello');
  console.log("upload to public-assets:", data, error);

  const { data: data2, error: error2 } = await supabase.storage.from('student-profiles').upload('test.txt', 'hello');
  console.log("upload to student-profiles:", data2, error2);
}
test();
