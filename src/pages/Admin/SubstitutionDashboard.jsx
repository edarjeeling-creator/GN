import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, UserMinus, Calendar } from 'lucide-react';
import { generateSubstitutions } from '../../utils/substitutionEngine';

const SubstitutionDashboard = ({ classes, subjects, profiles }) => {
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [absences, setAbsences] = useState([]);
  const [deltas, setDeltas] = useState([]);
  const [masterRoutine, setMasterRoutine] = useState([]);
  const [teacherMeta, setTeacherMeta] = useState([]);
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [selectedAbsentTeacher, setSelectedAbsentTeacher] = useState('');
  const teachers = profiles.filter(p => p.role === 'teacher');

  useEffect(() => {
    fetchData();
  }, [targetDate]);

  const fetchData = async () => {
    // 1. Fetch absences for the date
    const { data: absenceData } = await supabase
      .from('teacher_attendance')
      .select('*')
      .eq('date', targetDate);
    setAbsences(absenceData || []);

    // 2. Fetch all existing deltas for the date
    const { data: deltaData } = await supabase
      .from('daily_routine_delta')
      .select('*')
      .eq('date', targetDate);
    setDeltas(deltaData || []);

    // 3. Fetch Master Routine for the day of week (1=Mon)
    const d = new Date(targetDate);
    const dayOfWeek = d.getDay();
    const { data: routineData } = await supabase
      .from('master_routine')
      .select('*, classes(name, section), subjects(name)')
      .eq('day_of_week', dayOfWeek);
    setMasterRoutine(routineData || []);

    // 4. Fetch metadata and subjects
    const { data: meta } = await supabase.from('teacher_metadata').select('*');
    setTeacherMeta(meta || []);
    
    const { data: tSubj } = await supabase.from('teacher_subjects').select('*');
    setTeacherSubjects(tSubj || []);
  };

  const handleGenerate = async () => {
    const absentIds = absences.filter(a => a.status.includes('Absent')).map(a => a.teacher_id);
    if (absentIds.length === 0) return alert("No absences recorded for this day.");

    const d = new Date(targetDate);
    const dayOfWeek = d.getDay();

    const newDeltas = generateSubstitutions(
      targetDate, 
      dayOfWeek, 
      absentIds, 
      masterRoutine, 
      deltas, 
      teacherMeta, 
      teacherSubjects, 
      profiles
    );

    if (newDeltas.length === 0) return alert("No substitutions required.");

    // Filter out internal fields and format for insert
    const payload = newDeltas.map(d => ({
      date: d.date,
      master_routine_id: d.master_routine_id,
      absent_teacher_id: d.absent_teacher_id,
      substitute_teacher_id: d.substitute_teacher_id,
      priority_used: d.priority_used,
      override_modifier: d.override_modifier,
      status: d.status
    }));

    const { error } = await supabase.from('daily_routine_delta').insert(payload);
    if (error) alert("Error generating: " + error.message);
    else {
      alert("Substitutions generated successfully!");
      fetchData();
    }
  };

  const getProfileName = (id) => profiles.find(p => p.id === id)?.name || 'Unknown';

  const markTeacherAbsent = async () => {
    if (!selectedAbsentTeacher) return alert("Select a teacher first");
    
    // Check if already absent
    if (absences.some(a => a.teacher_id === selectedAbsentTeacher)) {
      return alert("Teacher is already marked absent for this date.");
    }

    const { error } = await supabase.from('teacher_attendance').insert([{
      teacher_id: selectedAbsentTeacher,
      date: targetDate,
      status: 'Absent'
    }]);

    if (error) {
      alert("Error marking absent: " + error.message);
    } else {
      setSelectedAbsentTeacher('');
      fetchData();
    }
  };

  const removeTeacherAbsence = async (id) => {
    const { error } = await supabase.from('teacher_attendance').delete().eq('id', id);
    if (error) alert("Error removing absence: " + error.message);
    else fetchData();
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header & Controls */}
      <div className="bento-card" style={{ padding: '2rem' }}>
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Daily Substitution Engine
          </h3>
          <div className="flex flex-wrap gap-4 items-center">
            <input 
              type="date" 
              className="input-field" 
              value={targetDate} 
              onChange={e => setTargetDate(e.target.value)} 
            />
            
            {/* Mark Absence UI */}
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <select 
                className="input-field py-2" 
                value={selectedAbsentTeacher} 
                onChange={e => setSelectedAbsentTeacher(e.target.value)}
              >
                <option value="">Select Teacher to Mark Absent...</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button className="btn btn-outline text-red-600 border-red-200 hover:bg-red-50" onClick={markTeacherAbsent}>
                Mark Absent
              </button>
            </div>

            <button className="btn-hero-primary ml-2" onClick={handleGenerate}>
              Run Auto-Substitution
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-slate-500 text-sm font-bold flex items-center gap-2"><UserMinus size={16}/> Absences Today</p>
            <p className="text-2xl font-bold mt-1 text-slate-800">{absences.length}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-slate-500 text-sm font-bold flex items-center gap-2"><Calendar size={16}/> Periods Affected</p>
            <p className="text-2xl font-bold mt-1 text-slate-800">
              {masterRoutine.filter(r => absences.map(a => a.teacher_id).includes(r.teacher_id)).length}
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-slate-500 text-sm font-bold flex items-center gap-2"><Users size={16}/> Subs Assigned</p>
            <p className="text-2xl font-bold mt-1 text-slate-800">{deltas.length}</p>
          </div>
        </div>

        {absences.length > 0 && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <h4 className="font-bold text-sm text-slate-500 mb-3 uppercase">Absent Teachers ({targetDate})</h4>
            <div className="flex flex-wrap gap-2">
              {absences.map(a => (
                <div key={a.id} className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1.5 rounded-full text-sm border border-red-100 font-medium">
                  <span>{getProfileName(a.teacher_id)}</span>
                  <button onClick={() => removeTeacherAbsence(a.id)} className="hover:text-red-900 bg-red-200/50 rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Blueprint View (Mobile Friendly Cards) */}
      <div className="bento-card" style={{ padding: '2rem' }}>
        <h4 className="font-bold mb-4 text-lg">Substitution Blueprint</h4>
        
        {deltas.length === 0 ? (
          <p className="text-slate-500">No substitutions active for {targetDate}.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deltas.map(d => {
              const orig = masterRoutine.find(m => m.id === d.master_routine_id);
              if (!orig) return null;

              return (
                <div key={d.id} className="p-4 rounded-lg border border-slate-200 bg-white shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold text-slate-800 text-lg">
                      {orig.classes.name} {orig.classes.section}
                    </span>
                    <span className="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded text-sm">
                      Period {orig.period_num}
                    </span>
                  </div>
                  
                  <div className="mt-2 text-sm text-slate-600">
                    <p><span className="font-bold w-16 inline-block">Absent:</span> {getProfileName(d.absent_teacher_id)}</p>
                    <p><span className="font-bold w-16 inline-block">Subject:</span> {orig.subjects?.name || orig.modifier_tags}</p>
                  </div>

                  <div className="mt-2 p-3 bg-green-50 border border-green-100 rounded-lg">
                    <p className="font-bold text-green-800 mb-1">Assigned Substitute:</p>
                    {d.substitute_teacher_id ? (
                      <p className="text-green-900 font-medium">{getProfileName(d.substitute_teacher_id)}</p>
                    ) : (
                      <p className="text-orange-600 font-medium">{d.override_modifier}</p>
                    )}
                    <p className="text-xs text-green-700 mt-1 uppercase font-bold">Priority Logic: {d.priority_used}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default SubstitutionDashboard;
