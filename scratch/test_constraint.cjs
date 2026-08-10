const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 5432,
  user: 'postgres',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres'
});
client.connect()
  .then(() => client.query(`
    SELECT
        conname AS constraint_name,
        contype AS constraint_type,
        a.attname AS column_name
    FROM
        pg_constraint c
    JOIN
        pg_class t ON c.conrelid = t.oid
    JOIN
        pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE
        t.relname = 'teacher_subjects' AND c.contype = 'u';
  `))
  .then(res => {
    console.log(res.rows);
    return client.end();
  })
  .catch(err => {
    console.error(err);
    client.end();
  });
