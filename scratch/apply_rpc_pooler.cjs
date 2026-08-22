const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: 'postgres://postgres.yeyebjohrytwfntgxxch:SuperSafeP4ssw0rd!@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
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
