const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const combos = [
  { host: 'grades.gyanodayniketan.cloud', port: 5432, user: 'postgres', database: 'postgres' },
  { host: 'grades.gyanodayniketan.cloud', port: 5432, user: 'postgres.postgres', database: 'postgres' },
  { host: 'grades.gyanodayniketan.cloud', port: 5432, user: 'postgres.bvthdtrdneopazubwkad', database: 'postgres' },
  { host: 'grades.gyanodayniketan.cloud', port: 6543, user: 'postgres', database: 'postgres' },
  { host: 'grades.gyanodayniketan.cloud', port: 6543, user: 'postgres.postgres', database: 'postgres' },
  { host: 'grades.gyanodayniketan.cloud', port: 6543, user: 'postgres.bvthdtrdneopazubwkad', database: 'postgres' },
  { host: 'grades.gyanodayniketan.cloud', port: 54322, user: 'postgres', database: 'postgres' }
];

async function tryCombo(c) {
  const client = new Client({
    ...c,
    password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
    ssl: false,
    connectionTimeoutMillis: 3000
  });
  
  try {
    await client.connect();
    console.log(`SUCCESS: ${c.host}:${c.port} user=${c.user}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`FAILED: ${c.host}:${c.port} user=${c.user} -> ${err.message}`);
    return false;
  }
}

async function run() {
  for (const c of combos) {
    if (await tryCombo(c)) break;
  }
}
run();
