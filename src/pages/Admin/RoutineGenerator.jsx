import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, CheckCircle, Save } from 'lucide-react';

const RoutineGenerator = ({ classes, subjects, profiles }) => {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDay, setSelectedDay] = useState(1);
  const [routine, setRoutine] = useState(Array(9).fill({ teacher_id: '', subject_id: '', modifier: '', is_practical: false }));
  const [conflicts, setConflicts] = useState([]);
  
  const teachers = profiles.filter(p => p.role === 'teacher');
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  useEffect(() => {
    if (!selectedClass) {
      setRoutine(Array(9).fill({ teacher_id: '', subject_id: '', modifier: '', is_practical: false }));
      return;
    }
    
    const fetchExistingRoutine = async () => {
      const { data, error } = await supabase
        .from('master_routine')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('day_of_week', selectedDay)
        .order('period_num', { ascending: true });
        
      if (data && !error) {
        const newRoutine = Array(9).fill({ teacher_id: '', subject_id: '', modifier: '', is_practical: false });
        data.forEach(block => {
          if (block.period_num >= 1 && block.period_num <= 9) {
            newRoutine[block.period_num - 1] = {
              teacher_id: block.teacher_id || '',
              subject_id: block.subject_id || '',
              modifier: block.modifier_tags || '',
              is_practical: block.is_practical || false
            };
          }
        });
        setRoutine(newRoutine);
      }
    };
    
    fetchExistingRoutine();
  }, [selectedClass, selectedDay]);

  const handleCellChange = (periodIndex, field, value) => {
    const newRoutine = [...routine];
    newRoutine[periodIndex] = { ...newRoutine[periodIndex], [field]: value };
    setRoutine(newRoutine);
  };

  const checkConflicts = async () => {
    const newConflicts = [];
    
    // 1. Check local double-booking (same teacher twice in this very form)
    // 2. Check DB for Singularity Constraint
    for (let i = 0; i < routine.length; i++) {
      const block = routine[i];
      if (!block.teacher_id) continue;

      const { data, error } = await supabase
        .from('master_routine')
        .select('class_id, classes(name, section)')
        .eq('teacher_id', block.teacher_id)
        .eq('day_of_week', selectedDay)
        .eq('period_num', i + 1);

      if (data && data.length > 0) {
        // If it's for a different class, it's a conflict!
        if (data[0].class_id !== selectedClass) {
          const tName = teachers.find(t => t.id === block.teacher_id)?.name;
          newConflicts.push(`Period ${i + 1}: ${tName} is already assigned to ${data[0].classes.name} ${data[0].classes.section}`);
        }
      }
    }
    setConflicts(newConflicts);
    return newConflicts.length === 0;
  };

  const handleSave = async () => {
    if (!selectedClass) return alert("Select a class");
    
    const isClear = await checkConflicts();
    if (!isClear) return;

    // Build payload
    const payload = routine.map((r, i) => {
      if (!r.teacher_id) return null;
      return {
        class_id: selectedClass,
        teacher_id: r.teacher_id,
        subject_id: r.subject_id || null,
        day_of_week: selectedDay,
        period_num: i + 1,
        modifier_tags: r.modifier || null,
        is_practical: r.is_practical
      };
    }).filter(Boolean);

    if (payload.length === 0) return alert("Nothing to save");

    // Upsert or Delete-Insert
    await supabase.from('master_routine').delete().match({ class_id: selectedClass, day_of_week: selectedDay });
    const { error } = await supabase.from('master_routine').insert(payload);
    
    if (error) alert("Error: " + error.message);
    else alert("Saved successfully!");
  };

  return (
    <div className="bento-card" style={{ padding: '2rem' }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
        Master Routine Editor
      </h3>

      <div className="flex gap-4 mb-6">
        <select className="input-field flex-1" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
          <option value="">Select Class</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </select>
        
        <select className="input-field flex-1" value={selectedDay} onChange={e => setSelectedDay(Number(e.target.value))}>
          {days.map((d, i) => <option key={i+1} value={i+1}>{d}</option>)}
        </select>
      </div>

      {conflicts.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-lg border border-red-200">
          <h4 className="font-bold flex items-center gap-2"><AlertTriangle size={18}/> Singularity Conflicts Detected</h4>
          <ul className="list-disc ml-5 mt-2">
            {conflicts.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {routine.map((block, idx) => (
          <div key={idx} className="flex gap-3 items-center p-3 border rounded bg-slate-50">
            <div className="font-bold text-slate-500 w-24">Period {idx + 1}</div>
            
            <select className="input-field flex-1" value={block.teacher_id} onChange={e => handleCellChange(idx, 'teacher_id', e.target.value)}>
              <option value="">Select Teacher</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            
            <select className="input-field flex-1" value={block.subject_id} onChange={e => handleCellChange(idx, 'subject_id', e.target.value)}>
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <input 
              type="text" 
              className="input-field flex-1" 
              placeholder="Modifier (e.g. [LIB])" 
              value={block.modifier}
              onChange={e => handleCellChange(idx, 'modifier', e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button className="btn-hero-outline" onClick={checkConflicts}>Check Conflicts</button>
        <button className="btn-hero-primary flex items-center gap-2" onClick={handleSave}><Save size={18}/> Save Routine</button>
      </div>
    </div>
  );
};

export default RoutineGenerator;
