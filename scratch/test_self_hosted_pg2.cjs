const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.default:kp1ohfnnl54w3jyiiezcpezircc22kql@grades.gyanodayniketan.cloud:5432/postgres'
});
async function run() {
  try {
    await client.connect();
    console.log("Connected to Supavisor!");
    const res = await client.query('SELECT 1');
    console.log(res.rows);
  } catch(e) {
    console.log("Failed with default:", e.message);
  } finally {
    await client.end();
  }
}
run();
