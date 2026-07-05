const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function test() {
  const { error } = await supabase.from('notices').insert([{ 
    title: 'Test Notice', 
    message: 'https://drive.google.com/file/d/1Sa5HEPf3G-hQFQstmhlIQ6FbxtbPWK51/view Dear Parents/Guardians, This is to inform you that the school will remain closed on Monday, 6th July, as per the notification issued by the Gorkhaland Territorial Administration (GTA) declaring a public holiday on the occasion of the 125th birth anniversary of Dr. Shyama Prasad Mookerjee. School will reopen after the midterm break on Tuesday, 7th July 2026. We request all the parents to take not of the above Regards, Mrs Dipika Thapa Principal Gyanoday Niketan', 
    audience: 'all', 
    sender_uid: 'b567d2ce-f245-4277-90fb-29e2eb426e2a' 
  }]);
  console.log('Insert Error:', error);
}
test();
