import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const oldIdUrvashi = '39cbdd5e-07cb-4272-89c4-419acbe7dbaa';
  const newIdUrvashi = '215e579d-67a1-4401-a4a2-8f5e4c0bbf37';
  
  // Fix Urvashi's assignments
  const { data, error } = await supabaseAdmin
    .from('teacher_subjects')
    .update({ teacher_id: newIdUrvashi })
    .eq('teacher_id', oldIdUrvashi)
    .select();
    
  if (error) {
     console.error("Error updating Urvashi assignments:", error);
  } else {
     console.log(`Updated ${data.length} assignments for Urvashi.`);
  }
}

run();
