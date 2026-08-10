const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 5432,
  user: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    await client.connect();
    const sql = fs.readFileSync('scratch/inspect_auth.sql', 'utf8');
    await client.query(sql);
    console.log('RPC created');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}
run();
