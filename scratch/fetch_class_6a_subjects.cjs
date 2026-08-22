const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:postgres@grades.gyanodayniketan.cloud:5432/postgres',
});

async function main() {
  try {
    const { rows: classes } = await pool.query(`SELECT id FROM classes WHERE name = '6' AND section = 'A' LIMIT 1`);
    if (!classes.length) { console.log('Class 6A not found'); return; }
    const classId = classes[0].id;
    
    const { rows: subjects } = await pool.query(`SELECT id, name FROM subjects WHERE class_id = $1`, [classId]);
    console.log('--- Subjects for 6A ---');
    console.table(subjects);
    
    const { rows: students } = await pool.query(`SELECT id, roll_no, name FROM students WHERE class_id = $1 AND roll_no = 1`, [classId]);
    if (!students.length) { console.log('Student not found'); return; }
    const studentId = students[0].id;
    console.log('--- Student ---', students[0]);
    
    const { rows: marks } = await pool.query(`SELECT subject_id, score, term FROM marks WHERE student_id = $1`, [studentId]);
    console.log('--- Marks for Student ---');
    console.table(marks);
    
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
main();
