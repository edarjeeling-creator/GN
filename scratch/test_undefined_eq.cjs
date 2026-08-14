const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://results.gyanodayniketan.cloud', 'fake-key');

async function test() {
  try {
    const { data, error } = await supabase.from('conversations').select('id').eq('id', undefined);
    console.log("No throw", error);
  } catch (err) {
    console.log("Caught:", err, typeof err, err.message);
    console.log("JSON.stringify:", JSON.stringify(err));
  }
}
test();
