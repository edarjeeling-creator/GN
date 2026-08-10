import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDb() {
  const { data: users, error: usersErr } = await supabase.rpc('execute_sql', {
    query: "SELECT id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous FROM auth.users WHERE email IN ('admin@gyanodayniketan.cloud', 'subodh@gyanodayniketan.cloud');"
  });
  console.log('Users:', users, usersErr);

  const { data: identities, error: idErr } = await supabase.rpc('execute_sql', {
    query: "SELECT id, user_id, provider_id, provider, identity_data FROM auth.identities;"
  });
  console.log('Identities:', identities, idErr);
}

inspectDb();
