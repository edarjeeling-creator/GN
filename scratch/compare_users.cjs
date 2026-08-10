const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function compare() {
  const adminRes = await supabase.rpc('debug_get_user', { p_email: 'admin@gyanodayniketan.cloud' });
  const subodhRes = await supabase.rpc('debug_get_user', { p_email: 'subodh@gyanodayniketan.cloud' });
  
  if (adminRes.error) console.error('Admin Error:', adminRes.error);
  if (subodhRes.error) console.error('Subodh Error:', subodhRes.error);
  
  const fs = require('fs');
  fs.writeFileSync('admin.json', JSON.stringify(adminRes.data, null, 2));
  fs.writeFileSync('subodh.json', JSON.stringify(subodhRes.data, null, 2));
  console.log('Saved to admin.json and subodh.json');
}
compare();
