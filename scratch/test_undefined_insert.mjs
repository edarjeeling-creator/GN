import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://grades.gyanodayniketan.cloud', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbW9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE');

async function run() {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'direct',
        title: null,
        school_id: '00000000-0000-0000-0000-000000000000',
        created_by: undefined // IS THIS ALLOWED?
      })
      .select()
      .single();

    console.log("Error:", error);
    console.log("Is empty?", Object.keys(error || {}).length === 0);
  } catch(e) {
    console.error("Caught:", e);
  }
}
run();
