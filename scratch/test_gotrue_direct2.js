import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

async function test() {
  const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'direct_signup_test2@gyanodayniketan.cloud',
      password: 'password123',
      data: {
        name: 'Direct Test',
        full_name: 'Direct Test',
        role: 'teacher',
        school_id: 'd3b07384-d113-4956-a5ec-9af2c61146e5'
      }
    })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text);
}
test();
