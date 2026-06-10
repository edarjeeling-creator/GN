const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('student_notifications').select('*').limit(1);
  if (error) {
    console.error("student_notifications error:", error);
  } else {
    console.log("student_notifications exists:", data);
  }
}

test();
