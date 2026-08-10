const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 6543,
  user: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    await client.connect();
    
    // Check if column exists
    const { rows } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='students' AND column_name='house'
    `);
    
    if (rows.length === 0) {
       console.log('Adding column: house');
       await client.query(`ALTER TABLE public.students ADD COLUMN house TEXT`);
    } else {
       console.log('Column house already exists.');
    }
    console.log('Migration complete');
  } catch (err) {
    console.error('Connection error', err.message);
  } finally {
    await client.end();
  }
}
run();
