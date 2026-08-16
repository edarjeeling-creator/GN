const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODE3Mzk3NDQsImlzcyI6InN1cGFiYXNlIiwicmVmIjoiYnZ0aGR0cmRuZW9wYXp1YndrYWQiLCJyb2xlIjoic2VydmljZV9yb2xlIn0.o64h8rJg-N5_o4vE-9bA2h3uP_wD1aB-i_PqB_zXqMw';
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: marks, error } = await supabase.from('marks').select('*').limit(5);
  console.log('Marks:', marks);
  console.log('Error:', error);
}
run();
