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

async function run() {
  try {
    await client.connect();
    console.log('Connected to Postgres directly!');

    await client.query(`
      DROP POLICY IF EXISTS "Allow authenticated read feature_access" ON public.feature_access;
      DROP POLICY IF EXISTS "Allow public read feature_access" ON public.feature_access;

      CREATE POLICY "Allow public read feature_access" 
      ON public.feature_access 
      FOR SELECT 
      USING (true);
    `);

    console.log('Feature access RLS fixed!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}
run();
