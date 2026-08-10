import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data } = await supabaseAdmin.from('teacher_subjects').select('*').eq('teacher_id', '215e579d-67a1-4401-a4a2-8f5e4c0bbf37');
  console.log("Urvashi's New assignments:", data.length);
}
run();
