import fs from 'fs';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

async function run() {
  console.log('Calling create_teacher_bypass...');
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/create_teacher_bypass`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({
      p_email: 'subodh@gyanodayniketan.cloud',
      p_password: 'Subodh@123',
      p_name: 'Subodh',
      p_school_id: null
    })
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log('Success:', data);
  } else {
    const err = await res.text();
    console.error('Error:', err);
  }
}

run();
