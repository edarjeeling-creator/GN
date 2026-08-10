const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres.yeyebjohrytwfntgxxch:SuperSafeP4ssw0rd!@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function applyFixes() {
  const client = await pool.connect();
  try {
    console.log('Connected to DB!');

    // 1. Fix the trigger function to not use 'email' in public.profiles
    const fixTriggerSql = `
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        -- Insert into profiles without the non-existent 'email' column!
        INSERT INTO public.profiles (id, name, role)
        VALUES (
          new.id,
          COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          COALESCE(new.raw_user_meta_data->>'role', 'student')
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role;
        
        RETURN new;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
        RETURN new;
      END;
      $$;
    `;
    await client.query(fixTriggerSql);
    console.log('✅ Trigger function fixed!');

    // 2. Add email column to auth.identities just in case
    const fixIdentitiesSql = `
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'email') THEN
              ALTER TABLE auth.identities ADD COLUMN email text GENERATED ALWAYS AS (lower(identity_data->>'email')) STORED;
          END IF;
      END $$;
    `;
    await client.query(fixIdentitiesSql);
    console.log('✅ auth.identities fixed!');

    // 3. Enable the trigger (in case it was still disabled)
    await client.query(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;`);
    console.log('✅ Trigger enabled!');

  } catch (err) {
    console.error('❌ Error applying fixes:', err);
  } finally {
    client.release();
    pool.end();
  }
}

applyFixes();
