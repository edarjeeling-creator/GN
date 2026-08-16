const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://grades.gyanodayniketan.cloud', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE');

async function run() {
  const { data, error } = await supabase.from('assignments').insert([{
    teacher_uid: '32cd85d5-2ac2-409f-bcb8-97f4e44d9bbb',
    subject: 'AI',
    title: 'MCQ Test teacher_uid',
    file_url: 'test.pdf'
  }]);
  console.log("teacher_uid insert error:", error);
}
run();
