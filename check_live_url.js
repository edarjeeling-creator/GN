const https = require('https');

https.get('https://results.gyanodayniketan.cloud', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const match = data.match(/assets\/index-[^.]*\.js/);
    if (match) {
      https.get('https://results.gyanodayniketan.cloud/' + match[0], (res2) => {
        let js = '';
        res2.on('data', chunk => js += chunk);
        res2.on('end', () => {
          const supabaseUrl = js.match(/https:\/\/[^"']*supabase[^"']*/);
          console.log('Supabase URL found in live site:', supabaseUrl ? supabaseUrl[0] : 'None');
        });
      });
    }
  });
});
