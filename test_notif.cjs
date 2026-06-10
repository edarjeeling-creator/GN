const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('student_notifications')
    .upsert([{
      student_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5',
      attendance_date: '2026-06-08',
      title: 'Test',
      message: 'Test',
      type: 'absence_alert',
      channel: 'portal'
    }], { onConflict: 'student_id,attendance_date,type' });
    
  console.log("Error:", error);
}

test();
