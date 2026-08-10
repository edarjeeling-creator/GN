const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/nodiappu/GN/.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('profiles').insert([
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Test Teacher',
      role: 'teacher',
      school_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5'
    }
  ]);
  console.log("Data:", data);
  console.log("Error:", error);
}

test();
