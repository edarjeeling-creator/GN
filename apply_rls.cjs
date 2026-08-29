const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: 'postgres://postgres.yeyebjohrytwfntgxxch:SuperSafeP4ssw0rd!@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    const sql = fs.readFileSync('fix_feature_access_anon.sql', 'utf8');
    await client.connect();
    console.log('Connected directly!');
    
    await client.query(sql);
    console.log('RLS applied successfully.');
  } catch (err) {
    console.error('Migration error', err.message);
  } finally {
    await client.end();
  }
}
run();
