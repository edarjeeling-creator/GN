const fs = require('fs');

async function inspect() {
  const url = 'https://grades.gyanodayniketan.cloud';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbW9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
  
  try {
    console.log("Logging in as subodh...");
    const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'subodh@gyanodayniketan.cloud', password: 'Subodh@123' })
    });
    
    if (!authRes.ok) {
      console.log("Auth failed:", await authRes.text());
      return;
    }
    
    const token = (await authRes.json()).access_token;
    
    console.log("Fetching attendance_logs...");
    const res = await fetch(`${url}/rest/v1/attendance_logs?select=*&limit=1000`, {
      headers: { 'apikey': anonKey, 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      console.error("Fetch error:", await res.text());
      return;
    }
    
    const logs = await res.json();
    console.log(`Found ${logs.length} attendance_logs records.`);
    
    // Check for duplicates
    const counts = {};
    const exactDuplicates = [];
    logs.forEach(log => {
      const key = `${log.person_id}_${log.scan_time.split('T')[0]}`;
      if (!counts[key]) counts[key] = [];
      counts[key].push(log.scan_time);
      
      const exactKey = `${log.person_id}_${log.scan_time}`;
      if (counts[exactKey]) exactDuplicates.push(log);
      counts[exactKey] = true;
    });
    
    let dailyDups = 0;
    for (const [key, times] of Object.entries(counts)) {
      if (Array.isArray(times) && times.length > 1) {
        dailyDups++;
        console.log(`Person ${key} has ${times.length} scans on the same day:`, times);
      }
    }
    console.log(`Found ${dailyDups} cases of multiple scans per day for a person.`);
    console.log(`Found ${exactDuplicates.length} exact time duplicates.`);

  } catch (err) {
    console.error("Error inspecting database:", err);
  }
}
inspect();
