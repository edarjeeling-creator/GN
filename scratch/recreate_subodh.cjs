const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: 'postgresql://postgres.bvthdtrdneopazubwkad:kp1ohfnnl54w3jyiiezcpezircc22kql@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    await client.connect();
    console.log('Connected directly to pooler!');

    // First delete any broken traces of Subodh
    await client.query("DELETE FROM public.lib_members WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'subodh@gyanodayniketan.cloud')");
    await client.query("DELETE FROM public.profiles WHERE name = 'Subodh'");
    await client.query("DELETE FROM auth.identities WHERE email = 'subodh@gyanodayniketan.cloud'");
    await client.query("DELETE FROM auth.users WHERE email = 'subodh@gyanodayniketan.cloud'");

    // Call create_teacher_bypass
    const createRes = await client.query(`
      SELECT public.create_teacher_bypass(
        'subodh@gyanodayniketan.cloud',
        'Subodh@123',
        'Subodh',
        NULL
      )
    `);
    console.log('Create Result:', createRes.rows);

    // Make him an admin in profiles just in case he needs admin access
    const updateRes = await client.query(`
      UPDATE public.profiles 
      SET role = 'admin' 
      WHERE email = 'subodh@gyanodayniketan.cloud' OR name = 'Subodh'
    `);
    console.log('Updated role to admin');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
