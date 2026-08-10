const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 6543,
  user: 'postgres.bvthdtrdneopazubwkad',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Postgres directly!');

    // Check Prawesh Pradhan tokens
    const { rows } = await client.query(`
      SELECT email, confirmation_token, recovery_token, email_change_token_new
      FROM auth.users
      WHERE email = 'prawesh.pradhan@gyanodayniketan.cloud'
    `);
    console.log('Prawesh tokens:', rows);
    
    // Update them to ''
    await client.query(`
      UPDATE auth.users
      SET confirmation_token = '',
          recovery_token = '',
          email_change_token_new = ''
      WHERE confirmation_token IS NULL
         OR recovery_token IS NULL
         OR email_change_token_new IS NULL
    `);
    
    console.log("Tokens updated.");

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}
run();
