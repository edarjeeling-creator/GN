import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: assignments, error } = await supabaseAdmin
    .from('teacher_subjects')
    .select('*, profiles!inner(*)');
    
  console.log("Joined assignments (only with valid profiles):", assignments.length);

  const { data: allAssignments } = await supabaseAdmin
    .from('teacher_subjects')
    .select('*');

  console.log("All assignments total:", allAssignments.length);

  // Find assignments without a profile
  const profileIds = new Set(assignments.map(a => a.profiles.id));
  const orphans = allAssignments.filter(a => !profileIds.has(a.teacher_id));
  console.log("Orphaned assignments:", orphans.length);
  
  if (orphans.length > 0) {
     console.log("Sample orphan:", orphans[0]);
  }
}

run();
