require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

const SUPRIYA_ID = 'da9fd64d-adb4-47d1-a7d1-a6cea1545d69';

async function updateDatabase() {
  console.log('Checking profile...');
  // 1. Check if profile exists
  let { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', SUPRIYA_ID)
    .single();

  if (profileErr && profileErr.code !== 'PGRST116') { // PGRST116 is not found
    console.error('Error fetching profile:', profileErr);
    return;
  }

  if (!profile) {
    console.log('Profile not found. Creating profile...');
    const { error: insertErr } = await supabase
      .from('profiles')
      .insert([
        { 
          id: SUPRIYA_ID, 
          name: 'Ms Supriya Chettri', 
          role: 'teacher' 
        }
      ]);
    if (insertErr) {
      console.error('Error creating profile:', insertErr);
      return;
    }
  } else {
    console.log('Profile found. Updating name and role...');
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ name: 'Ms Supriya Chettri', role: 'teacher' })
      .eq('id', SUPRIYA_ID);
    
    if (updateErr) {
      console.error('Error updating profile:', updateErr);
      return;
    }
  }

  console.log('Updating class teacher mapping...');
  
  // 2. Map her to Class 5 A
  // We need to fetch the class id for 5 A first to be safe, or just update by name/section
  const { error: classErr } = await supabase
    .from('classes')
    .update({ class_teacher_id: SUPRIYA_ID })
    .eq('name', '5')
    .eq('section', 'A');

  if (classErr) {
    console.error('Error updating class mapping:', classErr);
    return;
  }

  console.log('Database mapping completed successfully!');
}

updateDatabase();
