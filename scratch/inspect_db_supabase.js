import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function run() {
  try {
    // 1. Future attendance
    const today = new Date().toISOString().split('T')[0];
    const { data: futureAttendance, error: err1 } = await supabase
      .from('attendance')
      .select('id, date')
      .gt('date', today);
    if (err1) throw err1;
    console.log('Future Attendance Count:', futureAttendance.length);

    // 2. Fee demands
    const { data: feeDemands, error: err2 } = await supabase
      .from('fee_demands')
      .select('student_id, academic_year, month');
    if (err2) throw err2;
    
    // Group and find duplicates
    const counts = {};
    feeDemands.forEach(d => {
      const k = `${d.student_id}_${d.academic_year}_${d.month}`;
      counts[k] = (counts[k] || 0) + 1;
    });
    const dupes = Object.entries(counts).filter(([k,v]) => v > 1);
    console.log('Duplicate Fee Demands Count:', dupes.length);
    if (dupes.length > 0) {
      console.log('Sample Dupes:', dupes.slice(0, 5));
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
