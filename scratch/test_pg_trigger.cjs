const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 5432,
  user: 'postgres', // might need to be just postgres since it's a self-hosted supabase (dokploy)?
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT pg_get_functiondef(oid)
      FROM pg_proc
      WHERE proname = 'handle_new_user';
    `);
    console.log(res.rows[0].pg_get_functiondef);
  } catch (err) {
    console.error('Error', err);
  } finally {
    await client.end();
  }
}
run();
