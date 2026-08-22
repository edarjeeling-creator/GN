const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  host: 'grades.gyanodayniketan.cloud', port: 5432, user: 'postgres.bvthdtrdneopazubwkad', database: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql', ssl: false
});
async function run() {
  await client.connect();
  const res = await client.query("SELECT * FROM feature_access WHERE feature_name='python_portal'");
  console.log(res.rows);
  const res2 = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'feature_access'");
  console.log(res2.rows);
  await client.end();
}
run();
