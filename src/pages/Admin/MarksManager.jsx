import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Trash2, Edit2, Save, X, Search, AlertTriangle } from 'lucide-react';

const MarksManager = ({ classes, subjects, academicYear }) => {
  const { students } = useData();
  const { profile } = useAuth();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Midterm_Exam');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [marksData, setMarksData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  const TERMS = [
    { id: 'Midterm_Exam', name: 'Mid-Term Exam' },
    { id: 'Midterm_Test', name: 'Mid-Term Test' },
    { id: 'Finalterm_Exam', name: 'Final-Term Exam' },
    { id: 'Finalterm_Test', name: 'Final-Term Test' },
    { id: 'Unit_Test', name: 'Unit Test' },
    { id: 'Half_Yearly', name: 'Half Yearly' }
  ];

  const fetchMarks = async () => {
    if (!selectedClassId || !selectedSubjectId || !selectedTerm) return;
    setLoading(true);
    try {
      const fullTerm = `${academicYear}_${selectedTerm}`;
      
      // Get all students for the class
      const classStudents = students.filter(s => s.class_id === selectedClassId);
      const studentIds = classStudents.map(s => s.id);
      
      if (studentIds.length === 0) {
        setMarksData([]);
        setLoading(false);
        return;
      }

      // Fetch marks for these students
      const { data, error } = await supabase
        .from('marks')
        .select('*')
        .in('student_id', studentIds)
        .eq('subject_id', selectedSubjectId)
        .eq('term', fullTerm);
        
      if (error) throw error;

      // Merge students with marks
      const mergedData = classStudents.map(student => {
        const markObj = data?.find(m => m.student_id === student.id);
        return {
          student,
          mark_id: markObj?.id || null,
          score: markObj?.score ?? '-'
        };
      }).sort((a, b) => a.student.roll_no - b.student.roll_no);

      setMarksData(mergedData);
    } catch (err) {
      console.error(err);
      alert("Error fetching marks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarks();
  }, [selectedClassId, selectedSubjectId, selectedTerm, academicYear, students]);

  useEffect(() => {
    const checkLockStatus = async () => {
      if (!selectedClassId || !selectedTerm) {
        setIsLocked(false);
        return;
      }
      
      // We look at the top-level term (e.g. 2026_Midterm_Exam) for lock status
      // selectedTerm in this component is like Midterm_Exam or Midterm_Test
      // The lock applies to the overall term (e.g. Midterm_Exam)
      const lockTerm = selectedTerm.includes('Test') ? selectedTerm.replace('Test', 'Exam') : selectedTerm;
      const fullTerm = `${academicYear}_${lockTerm}`;
      
      const { data } = await supabase
        .from('marks_status')
        .select('status')
        .eq('class_id', selectedClassId)
        .eq('term', fullTerm)
        .single();
      
      setIsLocked(data?.status === 'Locked' || data?.status === 'Published');
    };
    checkLockStatus();
  }, [selectedClassId, selectedTerm, academicYear]);

  const handleBulkDelete = async () => {
    if (!selectedClassId || !selectedTerm) {
      return alert("Please select a Class and Term to clear marks.");
    }
    
    const fullTerm = `${academicYear}_${selectedTerm}`;
    const cls = classes.find(c => c.id === selectedClassId);
    
    const confirmed = window.confirm(`⚠️ WARNING ⚠️\n\nAre you sure you want to delete ALL marks for:\nClass: ${cls.name} ${cls.section}\nTerm: ${fullTerm}\n\n(This action will soft-delete the records and can be restored by an admin)`);
    
    if (!confirmed) return;
    
    try {
      setLoading(true);
      const classStudents = students.filter(s => s.class_id === selectedClassId);
      const studentIds = classStudents.map(s => s.id);
      
      if (studentIds.length === 0) return alert("No students in this class.");
      
      // If a subject is selected, only delete for that subject. Otherwise, delete for ALL subjects.
      let query = supabase
        .from('marks')
        .update({ deleted_at: new Date().toISOString(), deleted_by: profile?.id })
        .in('student_id', studentIds)
        .eq('term', fullTerm)
        .is('deleted_at', null);
        
      if (selectedSubjectId) {
        query = query.eq('subject_id', selectedSubjectId);
      }
      
      const { error } = await query;
      
      if (error) throw error;
      alert("Marks successfully cleared.");
      fetchMarks();
    } catch (err) {
      console.error(err);
      alert("Error deleting marks: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async (studentId, currentMarkId) => {
    const fullTerm = `${academicYear}_${selectedTerm}`;
    const numValue = Number(editValue);
    
    if (isNaN(numValue)) {
      alert("Please enter a valid number.");
      return;
    }
    
    try {
      const { error } = await supabase.from('marks').upsert({
        id: currentMarkId,
        student_id: studentId,
        subject_id: selectedSubjectId,
        term: fullTerm,
        score: numValue
      }, { onConflict: 'student_id,subject_id,term' });
      
      if (error) throw error;
      
      setEditingId(null);
      fetchMarks();
    } catch (err) {
      console.error(err);
      alert("Error saving mark.");
    }
  };

  const filteredMarks = marksData.filter(m => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    return m.student.name.toLowerCase().includes(lowerQuery) || 
           String(m.student.roll_no).includes(lowerQuery);
  });

  return (
    <div className="bento-card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Marks Manager</h3>
          <p style={{ color: 'var(--text-secondary)' }}>View, edit, or clear imported marks for students.</p>
        </div>
      </div>
      
      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
          <select className="input-field" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
            <option value="">Select Class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Term</label>
          <select className="input-field" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
            {TERMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Subject (Optional for Bulk Delete)</label>
          <select className="input-field" value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)}>
            <option value="">Select Subject</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text" 
            placeholder="Search by name or roll no..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '35px' }}
          />
        </div>
        
        <button 
          onClick={handleBulkDelete}
          disabled={!selectedClassId || !selectedTerm || isLocked}
          className="btn-danger"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', background: (!selectedClassId || !selectedTerm || isLocked) ? '#f87171' : '#ef4444', color: 'white', border: 'none', fontWeight: 600, cursor: (!selectedClassId || !selectedTerm || isLocked) ? 'not-allowed' : 'pointer' }}
        >
          <Trash2 size={16} />
          {selectedSubjectId ? 'Clear Marks for Subject' : 'Clear ALL Marks for Class'}
        </button>
      </div>
      
      {isLocked && (
        <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: '#fff7ed', color: '#c2410c', borderRadius: '0.5rem', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
          <AlertTriangle size={18} /> Results for this term are Locked. Editing and clearing are disabled.
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Loading marks...</div>
      ) : (
        <>
          {(!selectedClassId || !selectedSubjectId) ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
              Please select a Class and Subject to view and edit individual marks.
            </div>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Roll No</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Name</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Score</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMarks.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No students found.</td>
                    </tr>
                  ) : (
                    filteredMarks.map((m) => (
                      <tr key={m.student.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem' }}>{m.student.roll_no}</td>
                        <td style={{ padding: '1rem', fontWeight: 500 }}>{m.student.name}</td>
                        <td style={{ padding: '1rem' }}>
                          {editingId === m.student.id ? (
                            <input
                              type="number"
                              className="input-field"
                              style={{ width: '100px', padding: '0.4rem' }}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit(m.student.id, m.mark_id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                          ) : (
                            <span style={{ 
                              padding: '0.25rem 0.75rem', 
                              background: m.score === '-' ? '#f1f5f9' : '#e0f2fe', 
                              color: m.score === '-' ? '#64748b' : '#0369a1',
                              borderRadius: '999px',
                              fontWeight: 600
                            }}>
                              {m.score}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          {editingId === m.student.id ? (
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              <button onClick={() => saveEdit(m.student.id, m.mark_id)} style={{ padding: '0.4rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                <Save size={16} />
                              </button>
                              <button onClick={() => setEditingId(null)} style={{ padding: '0.4rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                setEditingId(m.student.id);
                                setEditValue(m.score === '-' ? '' : m.score);
                              }}
                              disabled={isLocked}
                              style={{ padding: '0.4rem 0.8rem', background: 'white', color: isLocked ? '#94a3b8' : '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: isLocked ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', opacity: isLocked ? 0.6 : 1 }}
                            >
                              <Edit2 size={14} /> Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MarksManager;
