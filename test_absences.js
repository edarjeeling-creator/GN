import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('teacher_attendance').select('*').eq('date', '2026-06-04');
  console.log("Error:", error);
  console.log("Data length:", data?.length);
  console.log("Data:", JSON.stringify(data, null, 2));
}

test();
