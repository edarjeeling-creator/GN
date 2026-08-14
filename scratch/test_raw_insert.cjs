const fs = require('fs');

async function testApi() {
  const url = 'https://grades.gyanodayniketan.cloud';
  // Use anon key for auth request
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbW9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
  
  try {
    console.log("Logging in as subodh...");
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
    const userId = authData.user.id;
    console.log("Got token for user:", userId);
    
    // Now get the profile ID for Subodh
    const profRes = await fetch(`${url}/rest/v1/profiles?id=eq.${userId}&select=*`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`
      }
    });
    const profiles = await profRes.json();
    const profile = profiles[0];
    console.log("Profile:", profile);
    
    // Now try to insert a conversation!
    const newConvId = '123e4567-e89b-12d3-a456-426614174001';
    
    console.log("Inserting conversation...");
    const convRes = await fetch(`${url}/rest/v1/conversations`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: newConvId,
        type: 'direct',
        title: null,
        school_id: profile.school_id || '00000000-0000-0000-0000-000000000000',
        created_by: profile.id
      })
    });
    
    console.log("Insert Response Status:", convRes.status);
    console.log("Insert Response Headers:", Object.fromEntries(convRes.headers.entries()));
    const body = await convRes.text();
    console.log("Insert Response Body:", body);
    
  } catch (err) {
    console.error("Test script error:", err);
  }
}

testApi();
