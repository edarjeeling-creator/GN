const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Logging in...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'akash@gn.edu',
    password: 'password123'
  });
  if (authError) { console.error("Login failed", authError); return; }
  console.log("Logged in");

  const { data: classes } = await supabase.from('classes').select('id').limit(1);
  const classId = classes[0].id;

  const { data: students } = await supabase.from('students').select('*').eq('class_id', classId).limit(1);
  if (!students || students.length === 0) { console.log("No students"); return; }
  
  const student = students[0];
  const record = {
    student_id: student.id,
    class_id: student.class_id,
    date: new Date().toISOString().split('T')[0],
    academic_year: '2026',
    status: 'Present',
    remarks: 'Test save auth',
    marked_at: new Date().toISOString()
  };
  
  console.log("Attempting to upsert record:", record);
  const { data, error } = await supabase.from('attendance').upsert([record], { onConflict: 'student_id,date' });
  
  if (error) {
    console.error("UPSERT ERROR:", error);
  } else {
    console.log("SUCCESS");
  }
}

test();
