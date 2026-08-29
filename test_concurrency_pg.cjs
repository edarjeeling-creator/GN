const { Client } = require('pg');
const fs = require('fs');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 5432,
  user: 'postgres.postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  await client.connect();
  console.log('Connected to Postgres.');

  // 1. Apply the trigger fix
  const fixSql = fs.readFileSync('fix_duplicate_attendance.sql', 'utf8');
  await client.query(fixSql);
  console.log('Trigger applied successfully.');
  
  // 2. Test concurrency
  const { rows: students } = await client.query('SELECT id FROM students LIMIT 1');
  const studentId = students[0].id;
  
  console.log("Testing concurrency with student:", studentId);
  const timeStr = new Date().toISOString();
  
  // Concurrent insert
  const query = `
    INSERT INTO attendance_logs (person_type, person_id, status, scan_time)
    VALUES ('student', $1, 'Present', $2)
    RETURNING id
  `;
  
  const p1 = client.query(query, [studentId, timeStr]);
  const p2 = client.query(query, [studentId, timeStr]);
  
  try {
    const results = await Promise.all([p1, p2]);
    console.log("Result 1:", results[0].rows);
    console.log("Result 2:", results[1].rows);
  } catch (err) {
    console.error("Concurrent insert failed (as expected if duplicate protection works):", err.message);
  }
  
  // Check how many records were inserted
  const { rows: logs } = await client.query(`
    SELECT id, scan_time FROM attendance_logs 
    WHERE person_id = $1 AND scan_time = $2
  `, [studentId, timeStr]);
  
  console.log(`Found ${logs.length} records for this exact scan_time.`);
  if (logs.length === 1) {
    console.log("SUCCESS: Only one record was inserted.");
  } else if (logs.length > 1) {
    console.log("FAILURE: Multiple records were inserted.");
  }
  
  // Clean up
  if (logs.length > 0) {
    const ids = logs.map(l => l.id);
    await client.query(`DELETE FROM attendance_logs WHERE id = ANY($1)`, [ids]);
    console.log("Cleaned up test records.");
  }
  
  await client.end();
}
run();
