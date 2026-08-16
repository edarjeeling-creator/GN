const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODE3Mzk3NDQsImlzcyI6InN1cGFiYXNlIiwicmVmIjoiYnZ0aGR0cmRuZW9wYXp1YndrYWQiLCJyb2xlIjoic2VydmljZV9yb2xlIn0.o64h8rJg-N5_o4vE-9bA2h3uP_wD1aB-i_PqB_zXqMw';
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: students } = await supabase.from('students').select('id').limit(1);
  const studentId = students[0].id;
  const { data, error } = await supabase.from('marks').upsert({
      student_id: studentId, 
      subject_id: '949dcd00-360c-4e21-a37e-3fd3dd026af1',
      term: '2026_Midterm_Exam',
      score: null
  }, { onConflict: 'student_id,subject_id,term' }).select();
  
  console.log('Error:', error);
  console.log('Data:', data);
}
run();
