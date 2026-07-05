process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient('https://grades.gyanodayniketan.cloud', process.env.VITE_SUPABASE_KEY);

async function test() {
  console.log("URL:", process.env.VITE_SUPABASE_URL);
  const { data, error } = await supabase.from('schools').select('*').limit(1);
  console.log('Data:', data);
  console.log('Error:', error);
}
test();
