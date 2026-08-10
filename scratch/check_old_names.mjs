import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const oldIds = [
    '39cbdd5e-07cb-4272-89c4-419acbe7dbaa',
    'db06ec63-4be2-4415-be50-db64928b5d32'
  ];
  
  for (const oldId of oldIds) {
    const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(oldId);
    if (error) {
       console.error("Could not fetch old ID from auth.users (probably throws 500)");
       
       // Try a workaround to get the name of the teacher!
       // Wait, I can't query auth.users directly via API without hitting 500 error on the zombie rows.
       // Let's just find the names by querying the frontend or trying to match?
    } else {
       console.log(`Old ID ${oldId} belongs to:`, user?.user?.user_metadata?.name);
    }
  }
}

run();
