const { Client } = require('pg');
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
    await client.connect();
    console.log('Connected directly!');
    
    // Check if columns exist
    const { rows } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='students' AND column_name IN ('father_name', 'dob', 'blood_group', 'contact_number', 'address')
    `);
    console.log('Existing columns:', rows.map(r => r.column_name));
    
    const missing = ['father_name', 'dob', 'blood_group', 'contact_number', 'address'].filter(c => !rows.find(r => r.column_name === c));
    
    for (const col of missing) {
       console.log('Adding column:', col);
       await client.query(`ALTER TABLE public.students ADD COLUMN ${col} TEXT`);
    }
    console.log('Migration complete');
  } catch (err) {
    console.error('Connection error', err.message);
  } finally {
    await client.end();
  }
}
run();
