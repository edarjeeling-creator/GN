const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhb' +
'm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgI' +
'CJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
const supabase = createClient(supabaseUrl, key);

async function run() {
  const { data: classes, error } = await supabase.from('classes').select('*').order('name');
  if (error) console.error(error);
  else console.log(classes.map(c => `'${c.name}' AND section = '${c.section}'`).join('\n'));
}
run();
