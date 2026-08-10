const { Client } = require('pg');

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
    console.log('Connected!');

    // First delete if exists just in case
    await client.query("DELETE FROM auth.users WHERE email = 'subodh@gyanodayniketan.cloud'");
    
    // Call create_teacher_bypass
    const createRes = await client.query(`
      SELECT public.create_teacher_bypass(
        'subodh@gyanodayniketan.cloud',
        'Subodh@123',
        'Subodh',
        NULL
      )
    `);
    console.log('Create Result:', createRes.rows);

    // Make him an admin in profiles just in case he needs admin access
    const updateRes = await client.query(`
      UPDATE public.profiles 
      SET role = 'admin' 
      WHERE name = 'Subodh'
    `);
    console.log('Updated role to admin');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
