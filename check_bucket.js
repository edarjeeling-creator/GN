import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_KEY=')) key = line.split('=')[1].trim();
});

async function check() {
  const res = await fetch(`${url}/storage/v1/bucket`, {
    headers: { 'Authorization': `Bearer ${key}` }
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Data:", data);
}

check();
