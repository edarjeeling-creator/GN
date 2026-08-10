import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: allAssignments } = await supabaseAdmin
    .from('teacher_subjects')
    .select('*');

  const { data: allProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, name');

  const profileIds = new Set(allProfiles.map(p => p.id));
  const orphans = allAssignments.filter(a => !profileIds.has(a.teacher_id));
  
  console.log(`Found ${orphans.length} orphaned assignments`);
  
  if (orphans.length > 0) {
     const uniqueOldTeacherIds = [...new Set(orphans.map(o => o.teacher_id))];
     console.log("Unique orphaned teacher IDs:", uniqueOldTeacherIds);
     
     // For each unique old teacher ID, let's find the matching new teacher ID
     for (const oldId of uniqueOldTeacherIds) {
        // Find which subjects were assigned to this old ID
        const subjects = orphans.filter(o => o.teacher_id === oldId);
        console.log(`Old ID ${oldId} has ${subjects.length} assignments.`);
     }
  }
}

run();
