const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://grades.gyanodayniketan.cloud', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY5MTkxNzIyNiwKICAgICJleHAiOiAxOTU1NTA1NDU2Cn0.0wZ2-eM7z2pZk29O4A0z51z5v0-k4z4z5-0z5-0z50' // this is dummy, let me get it from env.
);

// I will read .env.local
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key = env.match(/VITE_SUPABASE_KEY=(.*)/)[1];

const realSupabase = createClient(url, key);

async function main() {
  const { data, error } = await realSupabase.rpc('get_student_report', { 
    p_uid: '849201', // the uid from screenshot is probably NOT 849201. I will just fetch class 6A's subjects.
    p_academic_year: '2026'
  });
  
  if (true) {
     const {data: cls} = await realSupabase.from('classes').select('*').eq('name', '6').eq('section', 'A').single();
     const {data: subs} = await realSupabase.from('subjects').select('*').eq('class_id', cls.id);
     console.log('Subjects for 6A:', subs);
  }
}
main();
