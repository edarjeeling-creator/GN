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
    
    // Check auth.users
    const userRes = await client.query(`
      SELECT id, email, encrypted_password, created_at
      FROM auth.users 
      WHERE email = 'sagar@gyanodayniketan.cloud'
    `);
    console.log('--- auth.users ---');
    console.log(userRes.rows);

    if (userRes.rows.length > 0) {
      const profileRes = await client.query(`
        SELECT id, name, role
        FROM public.profiles 
        WHERE id = $1
      `, [userRes.rows[0].id]);
      console.log('--- public.profiles ---');
      console.log(profileRes.rows);
    }
  } catch (err) {
    console.error('Error', err);
  } finally {
    await client.end();
  }
}
run();
