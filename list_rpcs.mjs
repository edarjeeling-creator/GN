import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const headers = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`
};

async function run() {
  const res = await fetch(`${supabaseUrl}/rest/v1/`, { headers });
  const openapi = await res.json();
  const rpcs = Object.keys(openapi.paths).filter(p => p.startsWith('/rpc/'));
  console.log('Available RPCs:', rpcs);
}
run();
