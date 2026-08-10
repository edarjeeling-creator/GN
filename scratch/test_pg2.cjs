const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 54322,
  user: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    await client.connect();
    console.log('Connected directly!');
    
    // Check what is wrong with handle_new_user trigger
    const res = await client.query('SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = \'handle_new_user\'');
    console.log(res.rows[0]);
  } catch (err) {
    console.error('Connection error', err.message);
  } finally {
    await client.end();
  }
}
run();
