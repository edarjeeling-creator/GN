import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_KEY=')) key = line.split('=')[1].trim();
});
const supabase = createClient(url, key);

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'rs@gyanoday.edu.np', // Just guess an email or test without auth
    password: 'password'
  });
  
  const { data, error } = await supabase.storage.from('chat-attachments').upload('test.txt', 'hello world');
  console.log("Upload Error:", error);
  console.log("Upload Data:", data);
}
run();
