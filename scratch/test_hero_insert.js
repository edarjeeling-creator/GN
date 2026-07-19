import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_KEY=(.*)/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  async function test() {
    const { data, error } = await supabase.from('hero_slides').insert([{ media_url: 'test.png' }]);
    console.log('Error:', error);
    console.log('Data:', data);
  }
  test();
} else {
  console.log("Could not find keys in .env.local");
}
