import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://supabase.gyanodayniketan.cloud';
const supabaseKey = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRole() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'urvashi_rumba@gyanodayniketan.cloud',
    password: 'Password123!'
  });
  
  if (data?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();
    console.log("Profile:", profile);
  }
}
checkRole();
