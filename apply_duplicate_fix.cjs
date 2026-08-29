const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: 'grades.gyanodayniketan.cloud',
  port: 5432,
  user: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function applyFixes() {
  const client = await pool.connect();
  try {
    const fixSql = fs.readFileSync('fix_duplicate_attendance.sql', 'utf8');
    await client.query(fixSql);
    console.log('✅ fix_duplicate_attendance.sql applied');
    
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
