const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://postgres:SuperSafeP4ssw0rd!@db.yeyebjohrytwfntgxxch.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res1 = await pool.query(`ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_student_uid_fkey;`);
    console.log("Dropped constraint");
    
    // Check if there are any orphaned records before adding constraint
    await pool.query(`DELETE FROM public.assignments WHERE student_uid NOT IN (SELECT id FROM public.students);`);
    console.log("Cleaned orphaned assignments");

    const res2 = await pool.query(`ALTER TABLE public.assignments ADD CONSTRAINT assignments_student_uid_fkey FOREIGN KEY (student_uid) REFERENCES public.students(id) ON DELETE CASCADE;`);
    console.log("Added constraint to students(id)");
    
    // Need to trigger a schema cache reload for PostgREST
    await pool.query(`NOTIFY pgrst, 'reload schema';`);
    console.log("Reloaded schema");

  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    pool.end();
  }
}
run();
