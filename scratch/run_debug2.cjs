const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', 'bca2d46e-18a9-4484-8baa-ac441f267cf9')
    .single();
    
  if (error) {
    console.error('Error fetching profile:', error);
  } else {
    console.log('Profile:', JSON.stringify(data, null, 2));
  }
}
checkProfile();
