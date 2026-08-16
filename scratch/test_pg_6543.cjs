const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 6543,
  user: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log(res.rows);
  } catch (err) {
    console.error("6543 Error:", err);
  } finally {
    await client.end();
  }
}
run();
