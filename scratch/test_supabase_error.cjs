const { createClient } = require('@supabase/supabase-js');

// Mock a client to see what an error looks like
const supabase = createClient('https://results.gyanodayniketan.cloud', 'fake-key');

async function test() {
  try {
    const { error } = await supabase.from('conversations').insert({
      id: "invalid-uuid",
      type: 'invalid',
    });
    console.log("Error object:", error);
    console.log("JSON.stringify:", JSON.stringify(error));
  } catch (err) {
    console.error("Caught:", err);
  }
}
test();
