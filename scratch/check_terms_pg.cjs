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
  const res = await client.query('SELECT DISTINCT term FROM marks_status;');
  console.log('Marks Status Terms:', res.rows);
  const res2 = await client.query('SELECT DISTINCT term FROM marks;');
  console.log('Marks Terms:', res2.rows);
  await client.end();
}
run();
