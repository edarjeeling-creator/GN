const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.yeyebjohrytwfntgxxch:SuperSafeP4ssw0rd!@aws-0-ap-south-1.pooler.supabase.com:6543/postgres' });
async function run() {
  await client.connect();
  const res = await client.query(`SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename`);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
run();
