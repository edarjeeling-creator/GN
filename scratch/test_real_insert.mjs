import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbW9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    const newConvId = '123e4567-e89b-12d3-a456-426614174000';
    const otherUserId = 'fake-uuid-other';
    const profileId = 'fake-uuid-me';

    console.log("Inserting conversation...");
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .insert({
        id: newConvId,
        type: 'direct',
        title: null,
        school_id: '00000000-0000-0000-0000-000000000000',
        created_by: profileId
      });

    if (convError) throw convError;

    console.log("Inserting members...");
    const members = [
      { conversation_id: newConvId, profile_id: profileId, role: 'admin' },
      { conversation_id: newConvId, profile_id: otherUserId, role: 'member' }
    ];

    const { data: mems, error: membersError } = await supabase
      .from('conversation_members')
      .insert(members);

    if (membersError) throw membersError;

    console.log("Success!");
  } catch (err) {
    console.error("Caught error!");
    console.error("String(err):", String(err));
    console.error("JSON.stringify:", JSON.stringify(err));
    console.error("Keys:", Object.keys(err));
    console.error("Raw:", err);
  }
}

test();
