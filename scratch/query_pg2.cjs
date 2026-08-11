const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: 'postgresql://postgres.bvthdtrdneopazubwkad:kp1ohfnnl54w3jyiiezcpezircc22kql@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    await client.connect();
    
    console.log('--- Finding Supriya ---');
    const supriya = await client.query(`
      SELECT id, name, email, role FROM profiles WHERE name ILIKE '%Supriya%'
    `);
    console.log(supriya.rows);
    
    console.log('--- Find Class 5 A ---');
    const class5A = await client.query(`
      SELECT id, name, section FROM classes WHERE name = '5' AND section = 'A'
    `);
    console.log(class5A.rows);
    
    console.log('--- Classes Columns ---');
    const cols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'classes'
    `);
    console.log(cols.rows);

  } catch (err) {
    console.error('Error', err);
  } finally {
    await client.end();
  }
}
run();
