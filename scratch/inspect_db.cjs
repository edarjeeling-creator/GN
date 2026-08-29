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
    
    // 1. Check duplicate fee demands
    const dupFeeDemands = await client.query(`
      SELECT student_id, academic_year, month, COUNT(*) 
      FROM public.fee_demands 
      GROUP BY student_id, academic_year, month 
      HAVING COUNT(*) > 1
    `);
    console.log('Duplicate Fee Demands:', dupFeeDemands.rows);

    // 2. Check future attendance dates
    const futureAttendance = await client.query(`
      SELECT COUNT(*) as future_count 
      FROM public.attendance 
      WHERE date > CURRENT_DATE
    `);
    console.log('Future Attendance Count:', futureAttendance.rows[0].future_count);
    
    // 3. Inspect existing marks RLS
    const marksPolicies = await client.query(`
      SELECT policyname, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'marks' OR tablename = 'attendance'
    `);
    console.log('Marks/Attendance Policies:');
    marksPolicies.rows.forEach(p => console.log(JSON.stringify(p)));

    // 4. Inspect fee_payments RLS
    const feePolicies = await client.query(`
      SELECT policyname, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'fee_payments'
    `);
    console.log('Fee Payments Policies:');
    feePolicies.rows.forEach(p => console.log(JSON.stringify(p)));
    
  } catch (err) {
    console.error('Error', err.message);
  } finally {
    await client.end();
  }
}
run();
