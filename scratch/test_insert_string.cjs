const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://grades.gyanodayniketan.cloud', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE');

async function run() {
  const { data, error } = await supabase.from('assignments').insert([{
    student_uid: '12345',
    subject: 'AI',
    title: 'MCQ',
    file_url: 'test.pdf'
  }]);
  console.log("String insert error:", error);
}
run();
