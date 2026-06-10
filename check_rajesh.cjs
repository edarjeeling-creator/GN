const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: profiles } = await supabase.from('profiles').select('*').eq('name', 'Rajesh Singh');
  const rajeshId = profiles[0].id;

  const { data: ts } = await supabase.from('teacher_subjects').select('class_id').eq('teacher_id', rajeshId);
  const classIds = [...new Set(ts.map(t => t.class_id))];

  const { data: classes } = await supabase.from('classes').select('id, name, section').in('id', classIds);
  console.log("Rajesh's Assigned Classes:");
  console.dir(classes);
}

test();
