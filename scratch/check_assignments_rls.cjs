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
  try {
    await client.connect();
    const res = await client.query(`SELECT * FROM pg_policies WHERE tablename = 'assignments'`);
    console.log('Policies:', JSON.stringify(res.rows, null, 2));
    const cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'assignments'`);
    console.log('Columns:', JSON.stringify(cols.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
