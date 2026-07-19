import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_KEY=(.*)/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  async function read() {
    const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'why_choose_us').single();
    if (error) {
       console.log('Error:', error);
       return;
    }
    console.log(data.value);
  }
  read();
}
