const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgres://postgres.yeyebjohrytwfntgxxch:SuperSafeP4ssw0rd!@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function applyFixes() {
  const client = await pool.connect();
  try {
    const storageSql = fs.readFileSync('fix_storage_rls.sql', 'utf8');
    await client.query(storageSql);
    console.log('✅ fix_storage_rls.sql applied');
    
    const assignmentsSql = fs.readFileSync('fix_assignments_rls.sql', 'utf8');
    await client.query(assignmentsSql);
    console.log('✅ fix_assignments_rls.sql applied');
  } catch (err) {
    console.error('❌ Error applying fixes:', err);
  } finally {
    client.release();
    pool.end();
  }
}

applyFixes();
