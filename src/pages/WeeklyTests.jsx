import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit, FileText, CheckCircle, Clock, Calendar, Send } from 'lucide-react';
import { formatStudentDisplayName } from '../utils/studentUtils';
import { WeeklyTestReportService } from '../services/WeeklyTestReportService';
import TestExamNoticeModal from '../components/TestExamCommunication/TestExamNoticeModal';

export default function WeeklyTests() {
  const { profile: user } = useAuth();
  const [tests, setTests] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  
  // Form State
  const [newTest, setNewTest] = useState({
    class_id: '',
    subject_id: '',
    test_date: new Date().toISOString().split('T')[0],
    max_marks: 25
  });

  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({}); // { student_id: { score: '', is_absent: false } }
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [noticeModalTest, setNoticeModalTest] = useState(null);
  const userId = user?.id;

  const fetchTests = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('weekly_tests')
      .select(`
        *,
        classes (name, section),
        subjects (name)
      `)
      .eq('teacher_id', userId)
      .order('test_date', { ascending: false });
    
    if (data) setTests(data);
  }, [userId]);



  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!userId) return;
      const { data: tData } = await supabase
        .from('weekly_tests')
        .select(`
          *,
          classes (name, section),
          subjects (name)
        `)
        .eq('teacher_id', userId)
        .order('test_date', { ascending: false });
      if (!ignore && tData) setTests(tData);

      const { data: aData } = await supabase
        .from('teacher_subjects')
        .select('class_id, subject_id, classes(id, name, section), subjects(id, name)')
        .eq('teacher_id', userId);
      if (!ignore && aData) {
        setTeacherAssignments(aData);
        const uniqueClasses = [];
        const classMap = new Set();
        aData.forEach(item => {
          if (item.classes && !classMap.has(item.class_id)) {
            classMap.add(item.class_id);
            const displayName = item.classes.section 
              ? `${item.classes.name} ${item.classes.section}`.trim() 
              : item.classes.name;
            uniqueClasses.push({ 
              id: item.class_id, 
              name: displayName,
              rawName: item.classes.name,
              section: item.classes.section
            });
          }
        });
        uniqueClasses.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        setClasses(uniqueClasses);
      }
    }
    init();
    return () => { ignore = true; };
  }, [userId]);

  const availableSubjects = React.useMemo(() => {
    if (!newTest.class_id) {
      const subMap = new Set();
      const list = [];
      teacherAssignments.forEach(item => {
        if (item.subjects && !subMap.has(item.subject_id)) {
          subMap.add(item.subject_id);
          list.push(item.subjects);
        }
      });
      return list;
    }
    const filtered = teacherAssignments
      .filter(item => item.class_id === newTest.class_id && item.subjects)
      .map(item => item.subjects);
    
    const subMap = new Set();
    return filtered.filter(s => {
      if (subMap.has(s.id)) return false;
      subMap.add(s.id);
      return true;
    });
  }, [teacherAssignments, newTest.class_id]);

  const handleCreateTest = async (e) => {
    e.preventDefault();
    try {
      // Connect to authoritative weekly test cycle
      const cycle = await WeeklyTestReportService.getOrCreateCycle({
        testDate: newTest.test_date,
        createdBy: user?.id
      });

      const { data, error } = await supabase
        .from('weekly_tests')
        .insert([{
          class_id: newTest.class_id,
          subject_id: newTest.subject_id,
          teacher_id: user.id,
          test_date: newTest.test_date,
          max_marks: newTest.max_marks,
          cycle_id: cycle?.id || null,
          status: 'Draft'
        }])
        .select()
        .single();

      if (error) {
        alert(error.message);
        return;
      }

      setIsCreating(false);
      fetchTests();
      openTest(data);
    } catch (err) {
      alert('Error creating weekly test: ' + err.message);
    }
  };

  const openTest = async (test) => {
    setSelectedTest(test);
    
    // Fetch students for this class
    const { data: studentsData } = await supabase
      .from('students')
      .select('id, roll_no, name')
      .eq('class_id', test.class_id)
      .order('roll_no', { ascending: true });
    
    setStudents(studentsData || []);

    // Fetch existing marks if any
    const { data: marksData } = await supabase
      .from('weekly_test_marks')
      .select('*')
      .eq('test_id', test.id);
    
    const marksObj = {};
    if (studentsData) {
      studentsData.forEach(s => {
        const existing = marksData?.find(m => m.student_id === s.id);
        marksObj[s.id] = {
          score: existing ? existing.score : '',
          is_absent: existing ? existing.is_absent : false
        };
      });
    }
    setMarks(marksObj);
  };

  const handleMarkChange = (studentId, field, value) => {
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const saveMarks = async (status = 'Draft') => {
    setIsSubmitting(true);
    
    // Validate marks
    for (const s of students) {
      const m = marks[s.id];
      if (!m.is_absent && (m.score === '' || m.score === null)) {
         if (status === 'Submitted') {
            alert(`Please enter marks for ${s.name} or mark them absent before submitting.`);
            setIsSubmitting(false);
            return;
         }
      }
      if (m.score > selectedTest.max_marks) {
         alert(`Marks for ${s.name} cannot exceed maximum marks (${selectedTest.max_marks}).`);
         setIsSubmitting(false);
         return;
      }
    }

    const payload = students.map(s => ({
      test_id: selectedTest.id,
      student_id: s.id,
      score: marks[s.id].is_absent ? null : marks[s.id].score,
      is_absent: marks[s.id].is_absent,
      entered_by: user?.id,
      updated_by: user?.id
    }));

    // Upsert marks
    const { error: marksError } = await supabase
      .from('weekly_test_marks')
      .upsert(payload, { onConflict: 'test_id,student_id' });

    if (marksError) {
      alert('Failed to save marks: ' + marksError.message);
      setIsSubmitting(false);
      return;
    }

    // Update test status and authoritative completion metrics
    const entered = students.filter(s => marks[s.id]?.is_absent || (marks[s.id]?.score !== '' && marks[s.id]?.score !== null)).length;
    const absents = students.filter(s => marks[s.id]?.is_absent).length;
    const pending = Math.max(0, students.length - entered);

    await supabase
      .from('weekly_tests')
      .update({ 
        status,
        marks_entered_count: entered,
        marks_pending_count: pending,
        absent_count: absents,
        total_students_count: students.length,
        submitted_at: status === 'Submitted' ? new Date().toISOString() : selectedTest.submitted_at
      })
      .eq('id', selectedTest.id);

    setIsSubmitting(false);
    if (status === 'Submitted') {
      alert('Weekly test submitted successfully. Results will be included in the Monday Consolidated Report for Tuesday Assembly.');
      setSelectedTest(null);
      fetchTests();
    } else {
      alert('Draft saved successfully.');
    }
  };

  if (selectedTest) {
    const isReadOnly = selectedTest.status !== 'Draft';
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Weekly Test Marks Entry</h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Class: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTest.classes?.name} {selectedTest.classes?.section || ''}</span> | Subject: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTest.subjects?.name}</span> | Date: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTest.test_date}</span> | Max Marks: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTest.max_marks}</span> | Status: <span className="font-semibold text-brand-600 dark:text-brand-400">{selectedTest.status}</span>
            </p>
          </div>
          <button onClick={() => setSelectedTest(null)} className="btn-hero-outline">Back to List</button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Roll No</th>
                <th className="p-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Student Name</th>
                <th className="p-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Marks Obtained</th>
                <th className="p-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider text-center">Absent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {students.map(student => (
                <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{student.roll_no}</td>
                  <td className="p-4 font-semibold text-slate-900 dark:text-white">{formatStudentDisplayName(student.name)}</td>
                  <td className="p-4">
                    <input
                      type="number"
                      min="0"
                      max={selectedTest.max_marks}
                      disabled={isReadOnly || marks[student.id]?.is_absent}
                      value={marks[student.id]?.score || ''}
                      onChange={(e) => handleMarkChange(student.id, 'score', e.target.value)}
                      className="input-field w-32 font-bold text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:border-brand-500"
                      placeholder="e.g. 18"
                    />
                  </td>
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      disabled={isReadOnly}
                      checked={marks[student.id]?.is_absent || false}
                      onChange={(e) => handleMarkChange(student.id, 'is_absent', e.target.checked)}
                      className="w-5 h-5 text-brand-600 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-brand-500 cursor-pointer"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isReadOnly && (
          <div className="mt-6 flex justify-end gap-4">
            <button 
              onClick={() => saveMarks('Draft')} 
              disabled={isSubmitting}
              className="btn-hero-outline"
            >
              {isSubmitting ? 'Saving...' : 'Save as Draft'}
            </button>
            <button 
              onClick={() => {
                if(window.confirm('Are you sure you want to submit? You will not be able to edit this after submission.')) {
                  saveMarks('Submitted');
                }
              }}
              disabled={isSubmitting}
              className="btn-hero-primary"
            >
              Submit to Principal
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Teacher Completion Dashboard Card */}
      <div className="bg-gradient-to-r from-blue-900/30 to-slate-900 border border-blue-800/40 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md shrink-0">
              <Calendar size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">
                  Tuesday Weekly Test Module
                </span>
                <span className="text-xs text-slate-400 font-medium">Senior School (Classes 5–12)</span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">Weekly Tuesday Tests & Marks Entry</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Marks submitted here are automatically audited and compiled into the <strong>Monday Consolidated Report</strong> for Tuesday Assembly Honours.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setIsCreating(true)} className="btn-hero-primary flex items-center gap-2 text-xs py-2.5 px-4 cursor-pointer">
              <Plus size={18} /> New Weekly Test
            </button>
          </div>
        </div>

        {/* Quick Deadline Notice */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <span className="flex items-center gap-1.5 text-amber-300">
            <Clock size={14} />
            <strong>Report Deadline:</strong> Monday 8:00 AM before Tuesday Morning Assembly
          </span>
          <span className="text-slate-500">
            Authoritative Server Calculation Enabled
          </span>
        </div>
      </div>

      {isCreating && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Create New Weekly Test</h3>
          <form onSubmit={handleCreateTest} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Class</label>
              <select 
                required 
                className="input-field bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700" 
                value={newTest.class_id} 
                onChange={e => {
                  const selCls = classes.find(c => c.id === e.target.value);
                  const defMax = selCls ? WeeklyTestReportService.getClassWeeklyTestMaxMarks(selCls.rawName || selCls.name) : 25;
                  setNewTest({
                    ...newTest, 
                    class_id: e.target.value, 
                    subject_id: '',
                    max_marks: defMax
                  });
                }}
              >
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
              <select 
                required 
                className="input-field bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 disabled:opacity-50" 
                value={newTest.subject_id} 
                onChange={e => setNewTest({...newTest, subject_id: e.target.value})}
                disabled={!newTest.class_id}
              >
                <option value="">{newTest.class_id ? "Select Subject" : "First select a Class"}</option>
                {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Test Date</label>
              <input type="date" required className="input-field bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700" value={newTest.test_date} onChange={e => setNewTest({...newTest, test_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max Marks</label>
              <input type="number" required min="1" className="input-field bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700" value={newTest.max_marks} onChange={e => setNewTest({...newTest, max_marks: e.target.value})} />
            </div>
            <div className="md:col-span-4 flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setIsCreating(false)} className="btn-hero-outline">Cancel</button>
              <button type="submit" className="btn-hero-primary">Create Test</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tests.map(test => (
          <div key={test.id} className="bento-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openTest(test)}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <FileText size={24} />
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                test.status === 'Draft' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50' :
                test.status === 'Submitted' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
              }`}>
                {test.status === 'Draft' && <Clock size={12} />}
                {test.status === 'Submitted' && <CheckCircle size={12} />}
                {test.status === 'Approved' && <CheckCircle size={12} />}
                {test.status}
              </span>
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">{test.classes?.name} {test.classes?.section || ''} - {test.subjects?.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{new Date(test.test_date).toLocaleDateString()}</p>
            
            <div className="flex items-center text-sm font-semibold text-brand-600 dark:text-brand-400 gap-1.5">
              {test.status === 'Draft' ? <><Edit size={16}/> Continue Editing</> : <><FileText size={16}/> View Marks</>}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setNoticeModalTest(test);
              }}
              className="mt-3 w-full py-2 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send size={13} /> Send Test Notice to Students
            </button>
          </div>
        ))}
        {tests.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-12 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
            <FileText size={48} className="mx-auto text-slate-400 dark:text-slate-600 mb-4" />
            <p className="text-slate-600 dark:text-slate-400">No weekly tests found. Create your first one!</p>
          </div>
        )}
      </div>

      {noticeModalTest && (
        <TestExamNoticeModal
          isOpen={Boolean(noticeModalTest)}
          onClose={() => setNoticeModalTest(null)}
          onSuccess={() => {
            alert('Notice successfully published to students!');
            setNoticeModalTest(null);
          }}
          currentUser={user}
          teacherAssignments={teacherAssignments}
          classTeacherClasses={[]}
          prefilledData={{
            weekly_test_id: noticeModalTest.id,
            class_id: noticeModalTest.class_id,
            subject_id: noticeModalTest.subject_id,
            test_date: noticeModalTest.test_date,
            max_marks: noticeModalTest.max_marks,
            portion: noticeModalTest.portion,
            title: `${noticeModalTest.classes?.name || 'Class'} ${noticeModalTest.subjects?.name || ''} Weekly Test`,
            communication_type: 'TEST_ANNOUNCEMENT',
            scopeType: 'CLASS_SUBJECT'
          }}
        />
      )}
    </div>
  );
}
