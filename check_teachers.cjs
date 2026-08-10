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
    console.log('--- auth.users ---');
    const authRes = await client.query("SELECT email FROM auth.users WHERE email LIKE '%gyanodayniketan.cloud'");
    console.log(authRes.rows);

    console.log('--- public.profiles ---');
    const profRes = await client.query("SELECT id, name, full_name, role FROM public.profiles WHERE role = 'teacher'");
    console.log(profRes.rows);

    await client.end();
  } catch (err) {
    console.error('Connection error', err.message);
  }
}
run();
