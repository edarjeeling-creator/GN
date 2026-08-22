const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://grades.gyanodayniketan.cloud', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE');

async function run() {
  const { data, error } = await supabase.from('feature_access').select('*').limit(1);
  if (data && data.length > 0) {
     console.log(Object.keys(data[0]));
  } else {
     const { data: insertData, error: insertError } = await supabase.from('feature_access').insert({ feature_name: 'test' }).select();
     console.log("Insert Error:", insertError);
  }
}
run();
