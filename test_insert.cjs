const { createClient } = require('@supabase/supabase-js');
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabase = createClient(supabaseUrl, anonKey);

async function test() {
  const { data, error } = await supabase.from('assignments').insert([{
    student_uid: 'f5536d65-f3c3-4574-8624-a0306d9eef92',
    subject: 'AI',
    title: 'Test',
    file_url: 'test'
  }]);
  console.log("insert to assignments:", data, error);
}
test();
