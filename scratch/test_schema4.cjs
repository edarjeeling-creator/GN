const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(line => line.includes('=')).map(line => line.split('=')));

async function run() {
  const anonKey = env.VITE_SUPABASE_KEY;
  const url = env.VITE_SUPABASE_URL;
  const res = await fetch(`${url}/rest/v1/`, { headers: { 'apikey': anonKey } });
  const json = await res.json();
  if (json.definitions.notifications) {
    console.log("notifications props:", Object.keys(json.definitions.notifications.properties));
  } else {
    console.log("notifications does not exist");
  }
}
run();
