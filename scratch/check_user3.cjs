const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 5432,
  user: 'postgres.postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    await client.connect();
    
    // Check auth.users for sagar
    const userRes = await client.query(`
      SELECT id, email, created_at, encrypted_password
      FROM auth.users 
      WHERE email ILIKE '%sagar%' OR email ILIKE '%gyanodayniketan%'
    `);
    console.log('--- auth.users ---');
    console.log(userRes.rows);

    const profileRes = await client.query(`
      SELECT id, name, role, email
      FROM public.profiles 
      WHERE name ILIKE '%sagar%' OR email ILIKE '%sagar%'
    `);
    console.log('--- public.profiles ---');
    console.log(profileRes.rows);
  } catch (err) {
    console.error('Error', err);
  } finally {
    await client.end();
  }
}
run();
