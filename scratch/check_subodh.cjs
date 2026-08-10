const { Client } = require('pg');

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 5432,
  user: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function checkSubodh() {
  try {
    await client.connect();
    
    // Check auth.users
    const usersRes = await client.query("SELECT id, email, role FROM auth.users WHERE email = 'subodh@gyanodayniketan.cloud'");
    console.log("auth.users:", usersRes.rows);
    
    if (usersRes.rows.length > 0) {
      const userId = usersRes.rows[0].id;
      // Check auth.identities
      const identitiesRes = await client.query("SELECT id, provider, identity_data FROM auth.identities WHERE user_id = $1", [userId]);
      console.log("auth.identities:", identitiesRes.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkSubodh();
