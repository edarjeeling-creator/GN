import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_KEY=(.*)/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  async function patch() {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'why_choose_us').single();
    if (data && data.value) {
      let parsed = JSON.parse(data.value);
      let cards = parsed.cards || parsed;
      if (cards.length === 3) {
        cards.push({ title: 'Safe Environment', description: 'Secure campus with 24/7 CCTV surveillance and trained staff.', icon: 'CheckCircle', color: '#f59e0b', isActive: true });
        cards.push({ title: 'Expert Faculty', description: 'Highly qualified and experienced educators dedicated to student success.', icon: 'Users', color: '#ec4899', isActive: true });
        cards.push({ title: 'Extra-curriculars', description: 'Wide range of sports, arts, and clubs for all-round development.', icon: 'Trophy', color: '#0ea5e9', isActive: true });
        
        parsed.cards = cards;
        await supabase.from('site_settings').update({ value: JSON.stringify(parsed) }).eq('key', 'why_choose_us');
        console.log('Successfully patched database with 6 cards.');
      } else {
        console.log('Database already has different number of cards:', cards.length);
      }
    }
  }
  patch();
}
