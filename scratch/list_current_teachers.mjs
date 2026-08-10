import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: profiles } = await supabaseAdmin.from('profiles').select('id, name').eq('role', 'teacher');
  console.log("Current teachers:");
  profiles.forEach(p => console.log(`${p.name} - ${p.id}`));
}

run();
