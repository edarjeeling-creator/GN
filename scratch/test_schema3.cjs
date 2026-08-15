const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(line => line.includes('=')).map(line => line.split('=')));

async function run() {
  const anonKey = env.VITE_SUPABASE_KEY;
  const url = env.VITE_SUPABASE_URL;
  const res = await fetch(`${url}/rest/v1/`, { headers: { 'apikey': anonKey } });
  const json = await res.json();
  if (json.definitions.user_devices) {
    console.log("user_devices props:", Object.keys(json.definitions.user_devices.properties));
  } else {
    console.log("user_devices does not exist");
  }
}
run();
