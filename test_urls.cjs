process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function test() {
  const url1 = 'https://grades-pre0225supabase-545ad1-72-61-171-188.sslip.io';
  const url2 = 'https://grades.gyanodayniketan.cloud';
  const key = process.env.VITE_SUPABASE_KEY;

  console.log("Key prefix:", key ? key.substring(0, 10) : "missing");

  for (const u of [url1, url2]) {
    console.log(`\nTesting ${u}...`);
    try {
      const sb = createClient(u, key);
      const { data, error } = await sb.from('schools').select('*').limit(1);
      console.log('Error:', error);
      console.log('Data count:', data ? data.length : null);
    } catch (e) {
      console.log('Exception:', e.message);
    }
  }
}
test();
