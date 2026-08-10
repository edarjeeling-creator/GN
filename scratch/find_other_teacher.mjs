import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const oldId = 'db06ec63-4be2-4415-be50-db64928b5d32';
  
  // Check feature_access_audit_logs
  const { data: logs } = await supabaseAdmin.from('feature_access_audit_logs').select('*').or(`admin_id.eq.${oldId},target_id.eq.${oldId}`);
  if (logs && logs.length > 0) {
     console.log("Found in feature_access_audit_logs:", logs[0]);
  }
  
  // Check marks_audit_log
  const { data: marks } = await supabaseAdmin.from('marks_audit_log').select('*').eq('changed_by', oldId);
  if (marks && marks.length > 0) {
     console.log("Found in marks_audit_log, changer_name:", marks[0].changer_name);
  }
}

run();
