const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 5432,
  user: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Postgres directly!');

    await client.query(`
      -- Insert policy for conversations
      DROP POLICY IF EXISTS "Users can insert conversations they create" ON public.conversations;
      CREATE POLICY "Users can insert conversations they create" ON public.conversations
        FOR INSERT TO authenticated
        WITH CHECK (created_by = auth.uid());

      -- Insert policy for conversation_members
      DROP POLICY IF EXISTS "Users can insert conversation members" ON public.conversation_members;
      CREATE POLICY "Users can insert conversation members" ON public.conversation_members
        FOR INSERT TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.conversations c 
            WHERE c.id = conversation_id AND c.created_by = auth.uid()
          )
        );
    `);

    console.log('Insert policies added!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}
run();
