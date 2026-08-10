const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 5433,
  user: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});
async function run() {
  try {
    await client.connect();
    console.log('Connected to grades.gyanodayniketan.cloud:5433!');
    await client.end();
  } catch (err) {
    console.error('Connection error', err.message);
  }
}
run();
