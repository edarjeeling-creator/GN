const { Client } = require('pg');
const fs = require('fs');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: 'postgresql://postgres.bvthdtrdneopazubwkad:kp1ohfnnl54w3jyiiezcpezircc22kql@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    await client.connect();
    const sql = fs.readFileSync('scratch/create_conversation_rpc.sql', 'utf8');
    await client.query(sql);
    console.log('RPC created successfully');
  } catch (err) {
    console.error('Error', err);
  } finally {
    await client.end();
  }
}
run();
