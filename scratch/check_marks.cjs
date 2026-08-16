const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: 'postgresql://postgres.bvthdtrdneopazubwkad:kp1ohfnnl54w3jyiiezcpezircc22kql@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT * FROM public.marks 
    WHERE term LIKE '%2026%'
    ORDER BY updated_at DESC 
    LIMIT 10
  `);
  console.log(res.rows);
  await client.end();
}
run().catch(console.error);
