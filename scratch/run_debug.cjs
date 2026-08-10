const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  const { data, error } = await supabase.rpc('debug_get_user', { p_email: 'sagar@gyanodayniketan.cloud' });
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Result:', JSON.stringify(data, null, 2));
  }
}
checkUser();
