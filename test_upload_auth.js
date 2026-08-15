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
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: 'test_upload123@gyanoday.edu.np',
    password: 'password123'
  });
  
  if (authError) {
    console.log("Auth Error:", authError);
    // Maybe try logging in instead
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'test_upload123@gyanoday.edu.np',
      password: 'password123'
    });
    if (loginError) {
      console.log("Login Error:", loginError);
      return;
    }
  }
  
  const { data, error } = await supabase.storage.from('chat-attachments').upload(`default/test-conv/test-${Date.now()}.txt`, 'hello world');
  console.log("Upload Error:", error);
  console.log("Upload Data:", data);
}
run();
