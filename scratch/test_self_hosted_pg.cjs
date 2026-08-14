const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:your-super-secret-and-long-postgres-password@grades.gyanodayniketan.cloud:5432/postgres'
});
async function run() {
  try {
    await client.connect();
    console.log("Connected!");
  } catch(e) {
    console.log("Failed:", e.message);
  } finally {
    await client.end();
  }
}
run();
