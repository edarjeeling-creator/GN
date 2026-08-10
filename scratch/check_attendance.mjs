import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const oldId = 'db06ec63-4be2-4415-be50-db64928b5d32';
  
  const { data: attendance } = await supabaseAdmin.from('attendance').select('*').eq('recorded_by', oldId);
  if (attendance && attendance.length > 0) {
     console.log("Found in attendance! Recorded by:", attendance[0]);
  } else {
     console.log("Not found in attendance either.");
  }
}

run();
