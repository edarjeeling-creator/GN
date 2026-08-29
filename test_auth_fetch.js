import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://supabase.gyanodayniketan.cloud'
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'akash@gyanodayniketan.cloud',
    password: 'Password123!'
  })
  
  if (authError) {
    console.error('Auth Error:', authError)
    return
  }

  const { data, error } = await supabase.from('feature_access').select('*')
  console.log('Feature Access Count:', data ? data.length : 0)
  console.log('Error:', error)
}
test()
