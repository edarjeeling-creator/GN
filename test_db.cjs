const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:SuperSafeP4ssw0rd!@db.yeyebjohrytwfntgxxch.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error("err:", err.message);
  else console.log("success:", res.rows);
  pool.end();
});
