const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '/home/nodiappu/GN/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing env vars!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching feature_access anonymously...");
  const { data, error } = await supabase.from('feature_access').select('*');
  if (error) {
    console.error("Error fetching:", error);
  } else {
    console.log(`Success! Found ${data.length} records.`);
    console.log(data);
  }
}
run();
