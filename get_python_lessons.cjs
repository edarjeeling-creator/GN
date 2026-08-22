const fs = require('fs');

async function testApi() {
  const url = 'https://grades.gyanodayniketan.cloud';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbW9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
  
  try {
    const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'subodh@gyanodayniketan.cloud',
        password: 'Subodh@123'
      })
    });
    
    if (!authRes.ok) {
      console.log("Auth failed:", authRes.status, await authRes.text());
      return;
    }
    const authData = await authRes.json();
    const token = authData.access_token;
    
    const res = await fetch(`${url}/rest/v1/python_lessons?select=*&limit=1`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error("Test script error:", err);
  }
}
testApi();
