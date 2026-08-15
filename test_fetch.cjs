const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from('conversation_members')
    .select(`
      conversation_id,
      role,
      last_read_message_id,
      conversations (
        *,
        members:conversation_members (
          profile:profiles(id, name)
        )
      )
    `)
    .limit(1);
    
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}

run();
