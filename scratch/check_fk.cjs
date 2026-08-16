const { Client } = require('pg');
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
  await client.connect();
  const res = await client.query(`
    SELECT pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'assignments' AND c.conname = 'assignments_student_uid_fkey';
  `);
  console.log(res.rows);
  await client.end();
}
run();
