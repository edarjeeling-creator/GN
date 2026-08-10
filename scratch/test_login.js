import { supabase } from '../src/lib/supabase.js'

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'accountant@gyanodayniketan.cloud',
    password: 'wrongpassword123'
  })
  console.log("Error object:", error);
  if (error) {
    console.log("Message:", error.message);
  }
}
test()
