const { Client } = require('pg');
const fs = require('fs');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 5432,
  user: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    await client.connect();
    console.log('Connected directly!');
    
    const sql = `
      GRANT SELECT ON public.feature_access TO anon;
      GRANT SELECT ON public.feature_access TO authenticated;
      
      DROP POLICY IF EXISTS "Allow public read feature_access" ON public.feature_access;
      CREATE POLICY "Allow public read feature_access" 
      ON public.feature_access 
      FOR SELECT 
      USING (true);
    `;
    
    const res = await client.query(sql);
    console.log("Success executing SQL!");
  } catch (err) {
    console.error('Migration error', err.message);
  } finally {
    await client.end();
  }
}
run();
