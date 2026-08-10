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

async function checkSagar() {
  try {
    await client.connect();
    
    // check auth.users
    const authRes = await client.query("SELECT id, email, created_at, encrypted_password FROM auth.users WHERE email = 'sagar@gyanodayniketan.cloud'");
    console.log('auth.users result:', authRes.rows);
    
    if (authRes.rows.length > 0) {
      const uid = authRes.rows[0].id;
      // check public.profiles
      const profRes = await client.query("SELECT * FROM public.profiles WHERE id = $1", [uid]);
      console.log('public.profiles result:', profRes.rows);
    } else {
      // maybe search by name in profiles
      const profRes2 = await client.query("SELECT * FROM public.profiles WHERE name ILIKE '%sagar%'");
      console.log('public.profiles (by name search) result:', profRes2.rows);
    }
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

checkSagar();
