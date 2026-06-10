const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.W2oGkUa0mI7R6v7gI1K-Xf8O3H3X4E7Jv7E4W5Q0s5o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data: tables, error } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public');
  if (error) console.error("Error fetching tables:", error);
  else {
    console.log("Tables:");
    tables.forEach(t => console.log(t.table_name));
  }
}
checkSchema();
