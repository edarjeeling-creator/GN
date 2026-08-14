const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:SuperSafeP4ssw0rd!@db.yeyebjohrytwfntgxxch.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    // 1. Get an existing user
    const res = await pool.query('SELECT id FROM auth.users LIMIT 1');
    const userId = res.rows[0].id;
    
    console.log("User ID:", userId);

    // 2. Try inserting a conversation
    const insertRes = await pool.query(`
      INSERT INTO public.conversations (type, title, school_id, created_by)
      VALUES ('direct', 'Test', '00000000-0000-0000-0000-000000000000', $1)
      RETURNING id
    `, [userId]);
    
    const convId = insertRes.rows[0].id;
    console.log("Conversation created:", convId);

    // 3. Try inserting conversation members
    await pool.query(`
      INSERT INTO public.conversation_members (conversation_id, profile_id, role)
      VALUES ($1, $2, 'admin'), ($1, $2, 'member')
    `, [convId, userId]); // Using userId for both to test duplicate PK issue, wait, no let's use two users

    console.log("Success!");
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    pool.end();
  }
}

run();
