const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1];
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1];
});

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase
    .from('conversation_members')
    .select(`
      conversation_id,
      conversations (
        id,
        title,
        type,
        conversation_members (
          profiles ( id, name )
        )
      )
    `)
    .limit(1);
    
  console.log(JSON.stringify({data, error}, null, 2));
}

test();
