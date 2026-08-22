const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgres://postgres.yeyebjohrytwfntgxxch:SuperSafeP4ssw0rd!@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function applyFixes() {
  const client = await pool.connect();
  try {
    const marksStatusSql = fs.readFileSync('fix_marks_status_rls.sql', 'utf8');
    await client.query(marksStatusSql);
    console.log('✅ fix_marks_status_rls.sql applied');
    
    await client.query(`NOTIFY pgrst, 'reload schema'`);
    console.log('✅ schema reloaded');
  } catch (err) {
    console.error('❌ Error applying fixes:', err);
  } finally {
    client.release();
    pool.end();
  }
}

applyFixes();
