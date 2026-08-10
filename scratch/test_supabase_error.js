import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('attendance_logs').insert({ 
    person_type: 'teacher', 
    person_id: 'fake-uuid',
    status: 'Present'
  });
  console.log("Error object:", error);
}
test();
