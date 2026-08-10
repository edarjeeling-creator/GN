const { Client } = require('pg');
const fs = require('fs');
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
    const sql = fs.readFileSync('fix_teacher_signup_trigger.sql', 'utf8');
    await client.connect();
    console.log('Connected directly!');
    
    await client.query(sql);
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration error', err.message);
  } finally {
    await client.end();
  }
}
run();
