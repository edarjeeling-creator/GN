const { Client } = require('pg');
const fs = require('fs');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'db.bvthdtrdneopazubwkad.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function applyFixes() {
  try {
    await client.connect();
    console.log('Connected to Postgres directly!');

    const storageSql = fs.readFileSync('fix_storage_rls.sql', 'utf8');
    await client.query(storageSql);
    console.log('✅ fix_storage_rls.sql applied');
    
    const assignmentsSql = fs.readFileSync('fix_assignments_rls.sql', 'utf8');
    await client.query(assignmentsSql);
    console.log('✅ fix_assignments_rls.sql applied');
  } catch (err) {
    console.error('❌ Error applying fixes:', err.message);
  } finally {
    await client.end();
  }
}

applyFixes();
