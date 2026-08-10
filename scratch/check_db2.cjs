const { Client } = require('pg');

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 6543,
  user: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to port 6543 successfully');
    
    // Check auth.users
    const userRes = await client.query(`
      SELECT id, email, raw_user_meta_data
      FROM auth.users 
      WHERE email = 'sagar@gyanodayniketan.cloud'
    `);
    
    if (userRes.rows.length > 0) {
      const profileRes = await client.query(`
        SELECT id, name, role
        FROM public.profiles 
        WHERE id = $1
      `, [userRes.rows[0].id]);
      console.log('--- public.profiles ---');
      console.log(profileRes.rows);
    } else {
      console.log('User not found in auth.users');
    }
  } catch (err) {
    console.error('Error on port 6543:', err.message);
  } finally {
    await client.end();
  }
}
run();
