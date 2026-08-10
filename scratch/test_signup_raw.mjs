import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

async function run() {
  const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'newteacher123@gyanodayniketan.cloud',
      password: 'password123',
      data: {
        name: 'New Teacher',
        full_name: 'New Teacher',
        role: 'teacher'
      }
    })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text);
}

run();
