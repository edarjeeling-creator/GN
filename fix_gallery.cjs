const { Client } = require('pg');
const fs = require('fs');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 5432,
  user: 'postgres.bvthdtrdneopazubwkad',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS gallery (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          category TEXT,
          year TEXT,
          image_url TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
      );
      
      ALTER TABLE gallery ADD COLUMN IF NOT EXISTS category TEXT;
      ALTER TABLE gallery ADD COLUMN IF NOT EXISTS year TEXT;
      
      NOTIFY pgrst, 'reload schema';
    `;
    await client.connect();
    console.log('Connected directly!');
    await client.query(sql);
    console.log('Gallery fixed successfully!');
  } catch (err) {
    console.error('Migration error', err.message);
  } finally {
    await client.end();
  }
}
run();
