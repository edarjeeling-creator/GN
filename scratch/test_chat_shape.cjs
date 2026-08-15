const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(line => line.includes('=')).map(line => line.split('=')));

async function run() {
  const anonKey = env.VITE_SUPABASE_KEY;
  const url = env.VITE_SUPABASE_URL;

  const convRes = await fetch(`${url}/rest/v1/conversation_members?select=conversation_id,role,last_read_message_id,conversations(*)`, {
    headers: {
      'apikey': anonKey
    }
  });
  
  console.log("Status:", convRes.status);
  console.log("Body:", await convRes.text());
}
run();
