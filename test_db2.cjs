const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:postgres@grades.gyanodayniketan.cloud:5432/postgres'
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error("err:", err.message);
  else console.log("success:", res.rows);
  pool.end();
});
