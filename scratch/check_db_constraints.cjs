const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('feature_access').upsert({
    feature_name: 'test_feature',
    target_type: 'student',
    target_id: 'test_id',
    is_enabled: true
  }, { onConflict: 'feature_name,target_type,target_id' });
  console.log("Upsert result:", error ? error.message : "Success");
  process.exit(0);
}
check();
