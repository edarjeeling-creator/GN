const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.qXlA4i_gB5V1M4e7h5tWv2tNf-uD0B9w_Vf6E4qE1aA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('students').select('*').limit(1);
  if (error) console.error(error);
  else console.log(Object.keys(data[0] || {}));
}
run();
