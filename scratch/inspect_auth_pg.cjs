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
    
    // Find rajesh in auth.users
    const res = await client.query(`SELECT id, email, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, is_super_admin FROM auth.users WHERE email LIKE '%rajesh%'`);
    console.log('Rajesh auth users:', JSON.stringify(res.rows, null, 2));

    // Also get a valid user to compare
    const res2 = await client.query(`SELECT id, email, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, is_super_admin FROM auth.users WHERE email = 'admin@gyanodayniketan.cloud'`);
    console.log('Admin auth user:', JSON.stringify(res2.rows, null, 2));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}
run();
