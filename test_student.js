import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = 'https://supabase.gyanodayniketan.cloud'
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  console.log("Testing lookup_user_email...");
  const { data, error } = await supabase.rpc('lookup_user_email', {
    p_name: 'Fatima Samima',
    p_uid: '699412'
  });
  console.log("Result:", data);
  console.log("Error:", error);
}

test();
