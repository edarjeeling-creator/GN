const { Pool } = require('pg');
const pool = new Pool({
  host: 'grades.gyanodayniketan.cloud',
  port: 5432,
  user: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    await pool.query(`ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_student_uid_fkey;`);
    console.log("Dropped constraint");
    
    await pool.query(`DELETE FROM public.assignments WHERE student_uid NOT IN (SELECT id FROM public.students);`);
    console.log("Cleaned orphaned assignments");

    await pool.query(`ALTER TABLE public.assignments ADD CONSTRAINT assignments_student_uid_fkey FOREIGN KEY (student_uid) REFERENCES public.students(id) ON DELETE CASCADE;`);
    console.log("Added constraint to students(id)");
    
    await pool.query(`NOTIFY pgrst, 'reload schema';`);
    console.log("Reloaded schema");

  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    pool.end();
  }
}
run();
