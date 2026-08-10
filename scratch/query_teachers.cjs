const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 5432,
  user: 'postgres.bvthdtrdneopazubwkad',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    await client.connect();
    
    const res = await client.query(`
      SELECT column_name, column_default, is_generated
      FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users';
    `);
    console.table(res.rows);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
