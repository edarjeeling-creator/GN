const https = require('https');

const options = {
  hostname: 'grades.gyanodayniketan.cloud',
  port: 443,
  path: '/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
  method: 'GET'
};

const req = https.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const data = JSON.parse(body);
    const tableSchema = data.definitions.feature_access;
    console.log(JSON.stringify(tableSchema, null, 2));
  });
});
req.on('error', error => console.error(error));
req.end();
