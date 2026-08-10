const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  host: 'grades.gyanodayniketan.cloud',
  port: 6543,
  user: 'postgres.bvthdtrdneopazubwkad',
  password: 'kp1ohfnnl54w3jyiiezcpezircc22kql',
  database: 'postgres',
  ssl: false
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Postgres directly!');

    // Get the auth users to verify connection to auth schema
    const { rows } = await client.query(`SELECT id, email, role FROM auth.users WHERE email LIKE '%subodh%' OR email LIKE '%rajesh%' OR email LIKE '%test%'`);
    console.log('Found users to delete:', rows);

    // Run the fix script
    await client.query(`
      -- 1. Delete broken users that have no identities
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM auth.identities) AND role = 'authenticated'
        LOOP
          DELETE FROM public.lib_members WHERE user_id = r.id;
          DELETE FROM public.profiles WHERE id = r.id;
          DELETE FROM auth.users WHERE id = r.id;
        END LOOP;
      END $$;

      -- 2. Update the create_teacher_bypass function
      CREATE OR REPLACE FUNCTION public.create_teacher_bypass(
        p_email TEXT,
        p_password TEXT,
        p_name TEXT,
        p_school_id UUID
      ) RETURNS json AS $$
      DECLARE
        v_user_id UUID;
      BEGIN
        v_user_id := gen_random_uuid();

        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
          created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
        ) VALUES (
          '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
          p_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(), now(), now(),
          '{"provider":"email","providers":["email"]}',
          json_build_object('name', p_name, 'full_name', p_name, 'role', 'teacher', 'school_id', p_school_id),
          false
        );

        INSERT INTO auth.identities (
          provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
        ) VALUES (
          v_user_id::text, v_user_id,
          json_build_object('sub', v_user_id, 'email', p_email, 'email_verified', true),
          'email', now(), now(), now(), gen_random_uuid()
        );

        INSERT INTO public.profiles (id, name, role, school_id)
        VALUES (v_user_id, p_name, 'teacher', COALESCE(p_school_id, 'd3b07384-d113-4956-a5ec-9af2c61146e5'::uuid))
        ON CONFLICT (id) DO NOTHING;

        RETURN json_build_object('success', true, 'user_id', v_user_id);
      EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;
    `);

    console.log('Database fix script executed successfully!');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}
run();
