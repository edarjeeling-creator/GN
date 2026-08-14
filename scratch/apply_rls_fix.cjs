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

    await client.query(`
      DROP POLICY IF EXISTS "Users can view conversations they are members of" ON public.conversations;

      CREATE POLICY "Users can view conversations they are members of or created" ON public.conversations
        FOR SELECT TO authenticated
        USING (
          visibility = 'public' 
          OR created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.conversation_members cm 
            WHERE cm.conversation_id = id AND cm.profile_id = auth.uid()
          )
        );
    `);

    console.log('Conversations RLS fixed!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}
run();
