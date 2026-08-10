const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.bvthdtrdneopazubwkad:kp1ohfnnl54w3jyiiezcpezircc22kql@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to pooler!");
    
    // Check if sagar exists
    const res = await client.query("SELECT * FROM auth.users WHERE email = 'sagar@gyanodayniketan.cloud'");
    console.log("auth.users for sagar:", res.rows);
    
    // Check trigger definition
    const trigRes = await client.query(`
      SELECT pg_get_functiondef(oid) 
      FROM pg_proc 
      WHERE proname = 'handle_new_user';
    `);
    console.log("handle_new_user definition:\n", trigRes.rows[0].pg_get_functiondef);

  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
