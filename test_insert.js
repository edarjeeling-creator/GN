const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { error } = await supabase.from('notices').insert([{ 
    title: 'Test', 
    message: 'Test', 
    audience: 'students', 
    sender_uid: 'b567d2ce-f245-4277-90fb-29e2eb426e2a' 
  }]);
  console.log('Error:', error);
}
test();
