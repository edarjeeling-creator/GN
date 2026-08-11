require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('profiles').select('*').ilike('name', '%Supriya%');
  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }
  console.log('Found profiles:', data);

  const { data: classes, error: classesError } = await supabase.from('classes').select('*').eq('name', '5').eq('section', 'A');
  if (classesError) {
    console.error('Error fetching classes:', classesError);
    return;
  }
  console.log('Found class 5 A:', classes);
}

check();
