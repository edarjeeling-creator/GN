const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'db.bvthdtrdneopazubwkad.supabase.co',
  port: 5432,
  user: 'postgres',
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
      WHERE proname = 'handle_new_user'
    `);
    console.log('--- TRIGGER DEF ---');
    console.log(res.rows.map(r => r.pg_get_functiondef).join('\n\n'));
    console.log('--- END TRIGGER DEF ---');
  } catch (err) {
    console.error('Error', err);
  } finally {
    await client.end();
  }
}
run();
