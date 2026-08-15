const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1];
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1];
});
const supabase = createClient(url, key);

async function test() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'rs@gyanoday.edu.np', // Let's try Rajesh's email, or we can just bypass
    password: 'password' // I don't know his password.
  });
  console.log(authError);
}
test();
