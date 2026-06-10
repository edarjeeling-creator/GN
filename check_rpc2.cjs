const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.N3tS4m9541P0J_I8q0Q3v17H9cR8Y_E30VbQp96aX5c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
  const { data, error } = await supabase.rpc('this_function_does_not_exist', {
    p_device_info: 'test agent'
  });
  console.log('Non-existent RPC response:', { data, error });
}

testRpc();
