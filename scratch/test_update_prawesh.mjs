import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data, error } = await supabase.rpc('debug_get_user', { p_email: 'prawesh.pradhan@gyanodayniketan.cloud' });
  // Wait, I can't read triggers easily. Let's try to update the user with the service key to see if it throws a 500.
  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById('341f567a-7f1f-4490-b5bc-4de789d8e184', {
     password: 'Password123!'
  });
  console.log("Update Prawesh:", updateData, updateError);
}

run();
