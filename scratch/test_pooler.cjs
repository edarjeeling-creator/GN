const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: 'postgresql://postgres.bvthdtrdneopazubwkad:kp1ohfnnl54w3jyiiezcpezircc22kql@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    await client.connect();
    console.log('Connected directly to pooler!');
    
    // Let's check handle_new_user definition
    const res = await client.query('SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = \'handle_new_user\'');
    console.log(res.rows[0]);
    
    // Also let's check if auth schema is ok
    const authRes = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth'`);
    console.log('Auth tables:', authRes.rows.map(r => r.table_name));
    
  } catch (err) {
    console.error('Connection error', err.message);
  } finally {
    await client.end();
  }
}
run();
