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
  const { data, error } = await supabase.from('assignments').select('*, students!student_uid(*)').limit(1);
  console.log("Error querying students!student_uid:", error);
  
  const { data: d2, error: e2 } = await supabase.from('assignments').select('*, profiles!student_uid(*)').limit(1);
  console.log("Error querying profiles!student_uid:", e2);
}
run();
