const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 6543,
  user: 'postgres.bvthdtrdneopazubwkad',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

const sql = `
ALTER TABLE public.marks_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read marks_status" ON public.marks_status;
DROP POLICY IF EXISTS "Allow anonymous read marks_status" ON public.marks_status;

CREATE POLICY "Allow anonymous read marks_status" 
ON public.marks_status 
FOR SELECT 
USING (true);
`;

async function run() {
  try {
    await client.connect();
    console.log('Connected directly!');
    
    await client.query(sql);
    
    // Refresh schema cache
    await client.query('NOTIFY pgrst, \'reload schema\'');
    
    console.log('RLS policies updated successfully!');
  } catch (err) {
    console.error('Error', err.message);
  } finally {
    await client.end();
  }
}
run();
