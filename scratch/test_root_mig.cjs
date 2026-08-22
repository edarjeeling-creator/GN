const { Client } = require('pg');
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
    console.log("SUCCESS");
  } catch(e) {
    console.log("FAIL", e.message);
  } finally {
    await client.end();
  }
}
run();
