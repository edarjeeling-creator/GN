import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: orphans } = await supabaseAdmin
    .from('teacher_subjects')
    .select('*, classes(*), subjects(*)');
    
  const { data: allProfiles } = await supabaseAdmin.from('profiles').select('id, name');
  const profileIds = new Set(allProfiles.map(p => p.id));
  
  const actualOrphans = orphans.filter(a => !profileIds.has(a.teacher_id));
  
  for (const orphan of actualOrphans) {
     console.log(`Teacher ID: ${orphan.teacher_id} -> ${orphan.classes.name} ${orphan.classes.section} - ${orphan.subjects.name}`);
  }
}

run();
