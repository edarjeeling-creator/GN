const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 5432,
  user: 'postgres.postgres', // Supavisor default tenant? Or postgres? Or maybe postgres.public?
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    await client.connect();
    console.log('Connected directly!');
    const res = await client.query('SELECT 1 as result');
    console.log('Result:', res.rows);
  } catch (err) {
    console.error('Connection error', err.message);
  } finally {
    await client.end();
  }
}
run();
