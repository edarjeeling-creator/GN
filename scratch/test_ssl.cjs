const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgres://postgres.yeyebjohrytwfntgxxch:SuperSafeP4ssw0rd!@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  try {
    await client.connect();
    console.log("SUCCESS!");
    await client.end();
  } catch(e) {
    console.log("FAIL:", e.message);
  }
}
run();
