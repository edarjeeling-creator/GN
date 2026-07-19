const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

async function inspectSettings() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/site_settings?select=key,value`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (!res.ok) {
      console.error("Fetch error:", await res.text());
      return;
    }
    
    const settings = await res.json();
    console.log(JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error("Error inspecting site settings:", err);
  }
}

inspectSettings();
