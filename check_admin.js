const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Let's call lookup_user_email or fetch profiles from REST
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    if (error) {
      console.error("Error reading profiles:", error);
    } else {
      console.log("Profiles in DB:", data);
    }
  } catch (err) {
    console.error("Err:", err);
  }
}

check();
