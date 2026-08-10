import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function run() {
  const newAssignment = { 
    teacher_id: 'bca2d46e-18a9-4484-8baa-ac441f267cf9', // Sagar's ID
    class_id: '82eb1113-90d5-45d0-9993-9c8ad74cb459', // 5 A
    subject_id: 'd64bfa90-abd5-425e-a23b-678038c93ebe' // Math
  };
  
  console.log("Upserting:", newAssignment);
  const { data, error } = await supabase.from('teacher_subjects').upsert([newAssignment], { onConflict: 'teacher_id,class_id,subject_id' }).select();
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success:", data);
  }
}
run()
