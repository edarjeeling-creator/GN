const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(line => line.includes('=')).map(line => line.split('=')));

async function run() {
  const anonKey = env.VITE_SUPABASE_KEY;
  const url = env.VITE_SUPABASE_URL;

  const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sagar@gyanodayniketan.cloud', password: 'password123' })
  });
  const authData = await authRes.json();
  const token = authData.access_token;
  const userId = authData.user.id;

  const profRes = await fetch(`${url}/rest/v1/profiles?id=eq.${userId}&select=*`, {
    headers: { 'apikey': anonKey, 'Authorization': `Bearer ${token}` }
  });
  const profile = (await profRes.json())[0];

  const convRes = await fetch(`${url}/rest/v1/conversations`, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      id: '123e4567-e89b-12d3-a456-426614174006',
      type: 'direct',
      school_id: profile.school_id,
      created_by: profile.id
    })
  });
  
  console.log("Status:", convRes.status);
  console.log("Body:", await convRes.text());
}
run();
