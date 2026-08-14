const fetch = require('node-fetch');
const url = 'https://grades.gyanodayniketan.cloud/rest/v1/';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'; // from .env.local
async function check() {
  try {
    const r = await fetch(url + '?apikey=' + key);
    if (!r.ok) {
        console.log('Error:', await r.text());
        return;
    }
    const data = await r.json();
    console.log(Object.keys(data.paths).filter(p => p.includes('conversation')));
  } catch (e) { console.error(e); }
}
check();
