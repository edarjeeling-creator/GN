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
    
    // Set the tenant? No, let's just try schema auth
    await client.query('SET search_path TO auth, public;');
    
    // Find test4 in auth.users
    const res = await client.query(`SELECT * FROM auth.users WHERE email = 'test4@gyanodayniketan.cloud'`);
    console.log('Test4:', JSON.stringify(res.rows[0]));

    // Get a valid user to compare
    const res2 = await client.query(`SELECT * FROM auth.users WHERE email = 'admin@gyanodayniketan.cloud'`);
    console.log('Admin:', JSON.stringify(res2.rows[0]));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}
run();
