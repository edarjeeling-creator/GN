const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 5432,
  user: 'postgres.bvthdtrdneopazubwkad',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres'
});

async function run() {
  try {
    await client.connect();
    
    // Find who db06ec63-4be2-4415-be50-db64928b5d32 is
    const res = await client.query(`
      SELECT id, email, raw_user_meta_data->>'name' as name
      FROM auth.users
      WHERE id = 'db06ec63-4be2-4415-be50-db64928b5d32'
    `);
    
    console.log("Found user:", res.rows[0]);
  } catch (err) {
    console.error("Error connecting to postgres:", err.message);
  } finally {
    await client.end();
  }
}

run();
