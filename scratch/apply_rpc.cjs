const { Client } = require('pg');
const fs = require('fs');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 54322,
  user: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    const sql = fs.readFileSync('scratch/create_conversation_rpc.sql', 'utf8');
    await client.connect();
    console.log('Connected directly!');
    
    await client.query(sql);
    
    // Refresh schema cache
    await client.query('NOTIFY pgrst, \'reload schema\'');
    
    console.log('RPC created successfully!');
  } catch (err) {
    console.error('Error', err.message);
  } finally {
    await client.end();
  }
}
run();
