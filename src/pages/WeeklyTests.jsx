import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Edit, FileText, CheckCircle, Clock, Calendar, Send, 
  Printer, Search, Filter, Shield, User, AlertTriangle, 
  ArrowLeft, RefreshCw, X, CheckCircle2
} from 'lucide-react';
import { formatStudentDisplayName } from '../utils/studentUtils';
import { getStudentHouse } from '../utils/houseData';
import { WeeklyTestReportService } from '../services/WeeklyTestReportService';
import TestExamNoticeModal from '../components/TestExamCommunication/TestExamNoticeModal';

export default function WeeklyTests() {
  const { profile: user } = useAuth();
  const [tests, setTests] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Principal & Admin Oversight Filters
  const [selectedTeacherId, setSelectedTeacherId] = useState('ALL');
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedSubjectId, setSelectedSubjectId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Marksheet Search Filter
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

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

  // Determine if the current user has administrative / executive privileges
  const isPrivileged = useMemo(() => {
    if (!user) return false;
    return (
      user.role === 'principal' ||
      user.role === 'admin' ||
      user.role === 'superadmin' ||
      user.role === 'coordinator' ||
      (user.designation && (
        user.designation.toLowerCase().includes('principal') ||
        user.designation.toLowerCase().includes('coordinator')
      ))
    );
  }, [user]);

  // Fetch all tests according to role
  const fetchTests = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('weekly_tests')
        .select(`
          *,
          classes (id, name, section),
          subjects (id, name),
          profiles:teacher_id (id, name, email)
        `)
        .order('test_date', { ascending: false });

      if (!isPrivileged) {
        query = query.eq('teacher_id', userId);
      }

      const { data, error } = await query;
      if (!error && data) {
        setTests(data);
      } else if (error) {
        // Fallback without explicit profiles alias if schema differs
        const { data: fallbackData } = await supabase
          .from('weekly_tests')
          .select(`
            *,
            classes (id, name, section),
            subjects (id, name)
          `)
          .order('test_date', { ascending: false });

        if (fallbackData) {
          if (!isPrivileged) {
            setTests(fallbackData.filter(t => t.teacher_id === userId));
          } else {
            setTests(fallbackData);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching weekly tests:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, isPrivileged]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!userId) return;

      // 1. Fetch Tests
      await fetchTests();

      // 2. Fetch Teacher Directory for lookup & filtering
      const { data: tchrData } = await supabase
        .from('profiles')
        .select('id, name, email, role, designation')
        .order('name');
      if (!ignore && tchrData) {
        setAllTeachers(tchrData);
      }

      // 3. Fetch Classes & Subjects according to role
      if (isPrivileged) {
        // Principal/Admin gets access to all classes & subjects
        const { data: cData } = await supabase
          .from('classes')
          .select('id, name, section')
          .order('name');
        if (!ignore && cData) {
          const formatted = cData.map(c => ({
            id: c.id,
            name: c.section ? `${c.name} ${c.section}`.trim() : c.name,
            rawName: c.name,
            section: c.section
          })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
          setClasses(formatted);
        }

        const { data: sData } = await supabase
          .from('subjects')
          .select('id, name')
          .order('name');
        if (!ignore && sData) {
          setSubjectsList(sData);
        }
      } else {
        // Regular teacher assignments
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
    }
    init();
    return () => { ignore = true; };
  }, [userId, isPrivileged, fetchTests]);

  // Helper to reliably resolve teacher display name
  const getTeacherDisplayName = useCallback((test) => {
    if (test.profiles?.name) return test.profiles.name;
    if (test.teacher?.name) return test.teacher.name;
    const found = allTeachers.find(t => t.id === test.teacher_id);
    if (found?.name) return found.name;
    return 'Assigned Teacher';
  }, [allTeachers]);

  // Available subjects for test creation form
  const availableSubjects = useMemo(() => {
    if (isPrivileged) {
      return subjectsList;
    }
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
  }, [isPrivileged, subjectsList, teacherAssignments, newTest.class_id]);

  // KPI Overview calculations
  const kpiStats = useMemo(() => {
    const total = tests.length;
    const submitted = tests.filter(t => t.status === 'Submitted').length;
    const approved = tests.filter(t => t.status === 'Approved').length;
    const draft = tests.filter(t => t.status === 'Draft').length;
    return { total, submitted, approved, draft };
  }, [tests]);

  // Filtered tests based on user filters
  const filteredTests = useMemo(() => {
    return tests.filter(test => {
      if (selectedTeacherId !== 'ALL' && test.teacher_id !== selectedTeacherId) return false;
      if (selectedClassId !== 'ALL' && test.class_id !== selectedClassId) return false;
      if (selectedSubjectId !== 'ALL' && test.subject_id !== selectedSubjectId) return false;
      if (selectedStatus !== 'ALL' && test.status !== selectedStatus) return false;
      if (selectedDate && test.test_date !== selectedDate) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const className = `${test.classes?.name || ''} ${test.classes?.section || ''}`.toLowerCase();
        const subjectName = (test.subjects?.name || '').toLowerCase();
        const teacherName = getTeacherDisplayName(test).toLowerCase();
        const dateStr = (test.test_date || '').toLowerCase();
        if (!className.includes(q) && !subjectName.includes(q) && !teacherName.includes(q) && !dateStr.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [tests, selectedTeacherId, selectedClassId, selectedSubjectId, selectedStatus, selectedDate, searchQuery, getTeacherDisplayName]);

  // Create a new weekly test
  const handleCreateTest = async (e) => {
    e.preventDefault();
    try {
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

  // Open test for marksheet inspection / editing
  const openTest = async (test) => {
    setSelectedTest(test);
    setStudentSearchQuery('');
    
    // Fetch enrolled students for this class
    const { data: studentsData } = await supabase
      .from('students')
      .select('id, roll_no, name')
      .eq('class_id', test.class_id)
      .order('roll_no', { ascending: true });
    
    setStudents(studentsData || []);

    // Fetch existing marks
    const { data: marksData } = await supabase
      .from('weekly_test_marks')
      .select('*')
      .eq('test_id', test.id);
    
    const marksObj = {};
    if (studentsData) {
      studentsData.forEach(s => {
        const existing = marksData?.find(m => m.student_id === s.id);
        marksObj[s.id] = {
          score: existing && existing.score !== null && existing.score !== undefined ? existing.score : '',
          is_absent: existing ? existing.is_absent : false
        };
      });
    }
    setMarks(marksObj);
  };

  // Handle Mark Change
  const handleMarkChange = (studentId, field, value) => {
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  // Save Marks (Draft or Submitted)
  const saveMarks = async (status = 'Draft') => {
    setIsSubmitting(true);
    
    for (const s of students) {
      const m = marks[s.id];
      if (!m.is_absent && (m.score === '' || m.score === null)) {
        if (status === 'Submitted') {
          alert(`Please enter marks for ${s.name} or mark them absent before submitting.`);
          setIsSubmitting(false);
          return;
        }
      }
      if (m.score !== '' && m.score !== null && Number(m.score) > Number(selectedTest.max_marks)) {
        alert(`Marks for ${s.name} cannot exceed maximum marks (${selectedTest.max_marks}).`);
        setIsSubmitting(false);
        return;
      }
    }

    const payload = students.map(s => ({
      test_id: selectedTest.id,
      student_id: s.id,
      score: marks[s.id].is_absent || marks[s.id].score === '' ? null : Number(marks[s.id].score),
      is_absent: Boolean(marks[s.id].is_absent),
      entered_by: user?.id,
      updated_by: user?.id
    }));

    const { error: marksError } = await supabase
      .from('weekly_test_marks')
      .upsert(payload, { onConflict: 'test_id,student_id' });

    if (marksError) {
      alert('Failed to save marks: ' + marksError.message);
      setIsSubmitting(false);
      return;
    }

    const entered = students.filter(s => marks[s.id]?.is_absent || (marks[s.id]?.score !== '' && marks[s.id]?.score !== null)).length;
    const absents = students.filter(s => marks[s.id]?.is_absent).length;
    const pending = Math.max(0, students.length - entered);

    const updatePayload = {
      status,
      marks_entered_count: entered,
      marks_pending_count: pending,
      absent_count: absents,
      total_students_count: students.length,
      updated_at: new Date().toISOString()
    };

    if (status === 'Submitted') {
      updatePayload.submitted_at = new Date().toISOString();
    }

    await supabase
      .from('weekly_tests')
      .update(updatePayload)
      .eq('id', selectedTest.id);

    setIsSubmitting(false);
    setSelectedTest(prev => ({ ...prev, ...updatePayload }));

    if (status === 'Submitted') {
      alert('Weekly test marks submitted successfully to the Principal.');
      setSelectedTest(null);
      fetchTests();
    } else {
      alert(isPrivileged ? 'Marks updated successfully.' : 'Draft saved successfully.');
      fetchTests();
    }
  };

  // Principal / Administrator Approval
  const handleApproveTest = async (testId) => {
    if (!testId) return;
    if (!window.confirm('Are you sure you want to approve this weekly test? Once approved, it is officially verified for Monday reporting.')) {
      return;
    }
    try {
      const { error } = await supabase
        .from('weekly_tests')
        .update({ 
          status: 'Approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', testId);
      
      if (error) {
        alert('Failed to approve test: ' + error.message);
        return;
      }

      alert('Weekly test approved successfully!');
      if (selectedTest?.id === testId) {
        setSelectedTest(prev => ({ ...prev, status: 'Approved' }));
      }
      fetchTests();
    } catch (err) {
      alert('Error approving test: ' + err.message);
    }
  };

  // Re-open test if administrator requires teacher revision
  const handleReopenTest = async (testId) => {
    if (!testId) return;
    if (!window.confirm('Reopen this test to Draft? This will allow the teacher to edit and resubmit.')) {
      return;
    }
    try {
      const { error } = await supabase
        .from('weekly_tests')
        .update({ status: 'Draft', updated_at: new Date().toISOString() })
        .eq('id', testId);
      if (error) throw error;
      alert('Test reopened to Draft.');
      if (selectedTest?.id === testId) {
        setSelectedTest(prev => ({ ...prev, status: 'Draft' }));
      }
      fetchTests();
    } catch (err) {
      alert('Error reopening test: ' + err.message);
    }
  };

  // Active Marksheet calculations
  const marksheetMetrics = useMemo(() => {
    if (!selectedTest || students.length === 0) return null;
    const max = Number(selectedTest.max_marks) || 25;
    const passingMark = Math.round(max * 0.4);

    let evaluated = 0;
    let absent = 0;
    let passCount = 0;
    let failCount = 0;
    let attentionCount = 0;
    const validScores = [];

    students.forEach(s => {
      const m = marks[s.id];
      if (m?.is_absent) {
        absent++;
      } else if (m?.score !== '' && m?.score !== null && m?.score !== undefined) {
        const sc = Number(m.score);
        evaluated++;
        validScores.push(sc);
        if (sc >= passingMark) {
          passCount++;
        } else {
          failCount++;
        }
        if (sc < 10) {
          attentionCount++;
        }
      }
    });

    const average = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : '—';
    const highest = validScores.length > 0 ? Math.max(...validScores) : '—';
    const lowest = validScores.length > 0 ? Math.min(...validScores) : '—';
    const passRate = evaluated > 0 ? ((passCount / evaluated) * 100).toFixed(1) : '—';

    return {
      total: students.length,
      evaluated,
      absent,
      passCount,
      failCount,
      attentionCount,
      average,
      highest,
      lowest,
      passRate,
      passingMark
    };
  }, [selectedTest, students, marks]);

  // Compute ranks for display
  const rankedStudents = useMemo(() => {
    if (!selectedTest) return [];
    const max = Number(selectedTest.max_marks) || 25;
    const passingMark = Math.round(max * 0.4);

    const fullClassName = `${selectedTest.classes?.name || ''} ${selectedTest.classes?.section || ''}`.trim();

    const list = students.map(s => {
      const m = marks[s.id];
      const isAbsent = Boolean(m?.is_absent);
      const rawScore = m?.score !== '' && m?.score !== null && m?.score !== undefined ? Number(m.score) : null;
      const percentage = (!isAbsent && rawScore !== null && max > 0) ? ((rawScore / max) * 100).toFixed(1) : null;
      const house = getStudentHouse(s.name, fullClassName);

      let result = 'Pending';
      if (isAbsent) result = 'Absent';
      else if (rawScore !== null) {
        result = rawScore >= passingMark ? 'Pass' : 'Fail';
      }

      return {
        ...s,
        score: rawScore,
        isAbsent,
        percentage,
        result,
        house
      };
    });

    // Sort valid scores descending to assign ranks
    const sortedScores = [...new Set(list.filter(s => !s.isAbsent && s.score !== null).map(s => s.score))].sort((a, b) => b - a);
    return list.map(s => {
      let rank = '—';
      if (!s.isAbsent && s.score !== null) {
        const idx = sortedScores.indexOf(s.score);
        rank = idx !== -1 ? idx + 1 : '—';
      }
      return { ...s, rank };
    });
  }, [selectedTest, students, marks]);

  // Filter students in marksheet view
  const filteredMarksheetStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return rankedStudents;
    const q = studentSearchQuery.toLowerCase().trim();
    return rankedStudents.filter(s => 
      s.name.toLowerCase().includes(q) || 
      String(s.roll_no).includes(q) ||
      (s.house && s.house.toLowerCase().includes(q))
    );
  }, [rankedStudents, studentSearchQuery]);

  // -------------------------------------------------------------
  // VIEW: Detailed Marksheet of Selected Weekly Test
  // -------------------------------------------------------------
  if (selectedTest) {
    const isReadOnly = selectedTest.status !== 'Draft' && !isPrivileged;
    const teacherName = getTeacherDisplayName(selectedTest);
    const fullClassName = `${selectedTest.classes?.name || 'Class'} ${selectedTest.classes?.section || ''}`.trim();

    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        {/* Printable Only Format */}
        <div className="hidden print:block print:p-6 text-slate-950 font-sans">
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-4">
            <h1 className="text-2xl font-black uppercase tracking-wider">GYANODAY NIKETAN</h1>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700">Senior School Weekly Test Official Result Sheet</h2>
            <p className="text-xs text-slate-600 mt-1">Darjeeling, West Bengal</p>
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs border border-slate-300 p-2.5 mb-4 bg-slate-50">
            <div><strong>Class:</strong> {fullClassName}</div>
            <div><strong>Subject:</strong> {selectedTest.subjects?.name}</div>
            <div><strong>Date:</strong> {selectedTest.test_date}</div>
            <div><strong>Max Marks:</strong> {selectedTest.max_marks}</div>
            <div><strong>Teacher:</strong> {teacherName}</div>
            <div><strong>Status:</strong> {selectedTest.status}</div>
            <div><strong>Class Average:</strong> {marksheetMetrics?.average || '—'}</div>
            <div><strong>Pass Rate:</strong> {marksheetMetrics?.passRate}%</div>
          </div>

          <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
            <thead className="bg-slate-100 uppercase font-bold text-slate-800">
              <tr>
                <th className="p-1.5 border border-slate-300 w-12 text-center">Roll</th>
                <th className="p-1.5 border border-slate-300">Student Name</th>
                <th className="p-1.5 border border-slate-300 w-20 text-center">House</th>
                <th className="p-1.5 border border-slate-300 w-20 text-center">Marks</th>
                <th className="p-1.5 border border-slate-300 w-16 text-center">%</th>
                <th className="p-1.5 border border-slate-300 w-16 text-center">Rank</th>
                <th className="p-1.5 border border-slate-300 w-20 text-center">Result</th>
              </tr>
            </thead>
            <tbody>
              {rankedStudents.map(s => (
                <tr key={s.id} className={s.isAbsent ? 'bg-amber-50' : s.score < 10 && !s.isAbsent ? 'bg-rose-50' : ''}>
                  <td className="p-1.5 border border-slate-300 text-center font-bold">{s.roll_no}</td>
                  <td className="p-1.5 border border-slate-300 font-semibold">{formatStudentDisplayName(s.name)}</td>
                  <td className="p-1.5 border border-slate-300 text-center text-slate-600">{s.house || '—'}</td>
                  <td className="p-1.5 border border-slate-300 text-center font-bold">
                    {s.isAbsent ? 'ABSENT' : s.score !== null ? `${s.score} / ${selectedTest.max_marks}` : '—'}
                  </td>
                  <td className="p-1.5 border border-slate-300 text-center">{s.percentage ? `${s.percentage}%` : '—'}</td>
                  <td className="p-1.5 border border-slate-300 text-center font-bold">{s.rank}</td>
                  <td className="p-1.5 border border-slate-300 text-center font-semibold">{s.result}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-16 flex justify-between px-8 text-xs font-semibold">
            <div className="text-center border-t border-slate-400 pt-2 w-48">
              <span>Teacher Signature</span>
              <div className="text-[10px] text-slate-500 mt-0.5">{teacherName}</div>
            </div>
            <div className="text-center border-t border-slate-400 pt-2 w-48">
              <span>Principal Signature</span>
              <div className="text-[10px] text-slate-500 mt-0.5">Gyanoday Niketan</div>
            </div>
          </div>
        </div>

        {/* Screen Interactive View */}
        <div className="print:hidden space-y-5">
          {/* Top Command Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-white">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedTest(null)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back to Tests
                </button>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  selectedTest.status === 'Draft' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                  selectedTest.status === 'Submitted' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  {selectedTest.status === 'Draft' && '🟡 Draft Test'}
                  {selectedTest.status === 'Submitted' && '🔵 Submitted to Principal'}
                  {selectedTest.status === 'Approved' && '🟢 Approved Official'}
                </span>
                {isPrivileged && (
                  <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 text-[10px] font-bold">
                    Executive Oversight Mode
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                {fullClassName} — {selectedTest.subjects?.name}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <User size={13} className="text-brand-400" />
                  <strong>Teacher:</strong> {teacherName}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-amber-400" />
                  <strong>Test Date:</strong> {selectedTest.test_date}
                </span>
                <span>•</span>
                <span><strong>Max Marks:</strong> {selectedTest.max_marks}</span>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Print official result sheet"
              >
                <Printer size={14} />
                <span>Print Marksheet</span>
              </button>

              {isPrivileged && selectedTest.status === 'Submitted' && (
                <button
                  type="button"
                  onClick={() => handleApproveTest(selectedTest.id)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>Approve Test</span>
                </button>
              )}

              {isPrivileged && selectedTest.status === 'Approved' && (
                <button
                  type="button"
                  onClick={() => handleReopenTest(selectedTest.id)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>Reopen for Edit</span>
                </button>
              )}

              {(!isReadOnly || isPrivileged) && (
                <button
                  type="button"
                  onClick={() => saveMarks(selectedTest.status === 'Submitted' ? 'Submitted' : 'Draft')}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle size={14} />
                  <span>{isSubmitting ? 'Saving...' : (isPrivileged && selectedTest.status !== 'Draft' ? 'Save Mark Corrections' : 'Save as Draft')}</span>
                </button>
              )}

              {!isReadOnly && !isPrivileged && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Submit this weekly test to the Principal? You will not be able to edit after submission unless reopened.')) {
                      saveMarks('Submitted');
                    }
                  }}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Send size={14} />
                  <span>Submit to Principal</span>
                </button>
              )}
            </div>
          </div>

          {/* Class Summary KPI Metrics */}
          {marksheetMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Enrolled</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{marksheetMetrics.total}</span>
                <span className="text-[10px] text-slate-400 block">Total students</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Evaluated</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{marksheetMetrics.evaluated}</span>
                <span className="text-[10px] text-slate-400 block">{marksheetMetrics.total - marksheetMetrics.evaluated - marksheetMetrics.absent} pending</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Absentees</span>
                <span className="text-lg font-black text-amber-600 dark:text-amber-400">{marksheetMetrics.absent}</span>
                <span className="text-[10px] text-slate-400 block">Marked absent</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Class Avg</span>
                <span className="text-lg font-black text-brand-600 dark:text-brand-400">{marksheetMetrics.average}</span>
                <span className="text-[10px] text-slate-400 block">Out of {selectedTest.max_marks}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Top Score</span>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{marksheetMetrics.highest}</span>
                <span className="text-[10px] text-slate-400 block">Min: {marksheetMetrics.lowest}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Pass Rate</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{marksheetMetrics.passRate}%</span>
                <span className="text-[10px] text-rose-500 font-semibold block">{marksheetMetrics.attentionCount} below 10</span>
              </div>
            </div>
          )}

          {/* Search bar inside marksheet */}
          <div className="flex justify-between items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={studentSearchQuery}
                onChange={e => setStudentSearchQuery(e.target.value)}
                placeholder="Search by student name or roll..."
                className="input-field pl-9 py-2 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 w-full"
              />
            </div>

            <div className="text-xs text-slate-500">
              Showing <strong>{filteredMarksheetStudents.length}</strong> of {students.length} students
            </div>
          </div>

          {/* Student Marksheet Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-3 font-bold uppercase tracking-wider text-center w-14">Roll</th>
                  <th className="p-3 font-bold uppercase tracking-wider">Student Name</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-center w-24">House</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-center w-36">
                    Marks Obtained ({selectedTest.max_marks})
                  </th>
                  <th className="p-3 font-bold uppercase tracking-wider text-center w-20">Percentage</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-center w-16">Rank</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-center w-24">Absent</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-center w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredMarksheetStudents.map(student => {
                  const m = marks[student.id] || { score: '', is_absent: false };
                  const isBelowTen = !m.is_absent && m.score !== '' && Number(m.score) < 10;
                  const canEdit = !isReadOnly || isPrivileged;

                  return (
                    <tr 
                      key={student.id} 
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        m.is_absent ? 'bg-amber-50/40 dark:bg-amber-950/20' : isBelowTen ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="p-3 font-bold text-center text-slate-900 dark:text-slate-100">
                        {student.roll_no}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {formatStudentDisplayName(student.name)}
                        </div>
                      </td>
                      <td className="p-3 text-center text-slate-500 dark:text-slate-400 font-medium">
                        {student.house || '—'}
                      </td>
                      <td className="p-3 text-center">
                        {canEdit ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max={selectedTest.max_marks}
                              step="0.5"
                              disabled={m.is_absent}
                              value={m.score}
                              onChange={(e) => handleMarkChange(student.id, 'score', e.target.value)}
                              className="input-field w-20 font-bold text-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:border-brand-500 py-1"
                              placeholder="0"
                            />
                            <span className="text-slate-400 text-[11px]">/ {selectedTest.max_marks}</span>
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                            {m.is_absent ? '—' : m.score !== '' ? `${m.score} / ${selectedTest.max_marks}` : '—'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {student.percentage ? `${student.percentage}%` : '—'}
                      </td>
                      <td className="p-3 text-center font-mono font-bold">
                        {student.rank === 1 && <span className="text-amber-500">🥇 1</span>}
                        {student.rank === 2 && <span className="text-slate-400">🥈 2</span>}
                        {student.rank === 3 && <span className="text-amber-700">🥉 3</span>}
                        {typeof student.rank === 'number' && student.rank > 3 && (
                          <span className="text-slate-600 dark:text-slate-400">{student.rank}</span>
                        )}
                        {student.rank === '—' && <span className="text-slate-400">—</span>}
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={Boolean(m.is_absent)}
                          onChange={(e) => handleMarkChange(student.id, 'is_absent', e.target.checked)}
                          className="w-4 h-4 text-brand-600 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-brand-500 cursor-pointer disabled:opacity-50"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                          student.result === 'Pass' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50' 
                            : student.result === 'Fail' 
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/50' 
                            : student.result === 'Absent'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/50'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}>
                          {student.result}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: Weekly Tests List & Principal Oversight Dashboard
  // -------------------------------------------------------------
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900/40 via-slate-900 to-slate-900 border border-blue-800/40 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md shrink-0">
              <Calendar size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                  Senior School (Classes 5–12)
                </span>
                {isPrivileged && (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                    <Shield size={11} /> Principal & Administrative Oversight
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                Weekly Tuesday Tests & Marks Oversight
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
                {isPrivileged 
                  ? 'Authoritative overview of all weekly test marks entered by teachers across Senior School. Review, audit, approve submissions, and inspect student performance.' 
                  : 'Enter and submit your weekly test marks. Submissions are compiled into the Monday Consolidated Report for Tuesday Morning Assembly Honours.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsCreating(true)} 
              className="btn-hero-primary flex items-center gap-2 text-xs py-2.5 px-4 cursor-pointer"
            >
              <Plus size={16} /> New Weekly Test
            </button>
          </div>
        </div>

        {/* Quick Deadline Notice */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <span className="flex items-center gap-1.5 text-amber-300">
            <Clock size={14} />
            <strong>Official Report Release:</strong> Monday 8:00 AM before Tuesday Morning Assembly
          </span>
          <span className="text-slate-500">
            Classes 5–8 Max 25 • Classes 9–12 Max 20
          </span>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div 
          onClick={() => setSelectedStatus('ALL')} 
          className={`bg-white dark:bg-slate-900 border rounded-xl p-3.5 shadow-sm cursor-pointer transition ${
            selectedStatus === 'ALL' ? 'border-brand-500 ring-1 ring-brand-500' : 'border-slate-200 dark:border-slate-800 hover:border-slate-400'
          }`}
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Tests</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">{kpiStats.total}</span>
          <span className="text-[10px] text-slate-400 block">Senior school entries</span>
        </div>

        <div 
          onClick={() => setSelectedStatus('Submitted')} 
          className={`bg-white dark:bg-slate-900 border rounded-xl p-3.5 shadow-sm cursor-pointer transition ${
            selectedStatus === 'Submitted' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-800 hover:border-slate-400'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase block">Pending Approval</span>
            {kpiStats.submitted > 0 && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
            )}
          </div>
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5 block">{kpiStats.submitted}</span>
          <span className="text-[10px] text-slate-400 block">Submitted to Principal</span>
        </div>

        <div 
          onClick={() => setSelectedStatus('Approved')} 
          className={`bg-white dark:bg-slate-900 border rounded-xl p-3.5 shadow-sm cursor-pointer transition ${
            selectedStatus === 'Approved' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200 dark:border-slate-800 hover:border-slate-400'
          }`}
        >
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Approved</span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">{kpiStats.approved}</span>
          <span className="text-[10px] text-slate-400 block">Verified & Locked</span>
        </div>

        <div 
          onClick={() => setSelectedStatus('Draft')} 
          className={`bg-white dark:bg-slate-900 border rounded-xl p-3.5 shadow-sm cursor-pointer transition ${
            selectedStatus === 'Draft' ? 'border-amber-500 ring-1 ring-amber-500' : 'border-slate-200 dark:border-slate-800 hover:border-slate-400'
          }`}
        >
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block">Drafts</span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5 block">{kpiStats.draft}</span>
          <span className="text-[10px] text-slate-400 block">In progress by teachers</span>
        </div>
      </div>

      {/* Principal & Admin Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
            <Filter size={14} className="text-brand-500" />
            <span>Filter Tests & Marksheets</span>
          </div>

          {(selectedTeacherId !== 'ALL' || selectedClassId !== 'ALL' || selectedSubjectId !== 'ALL' || selectedStatus !== 'ALL' || selectedDate || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedTeacherId('ALL');
                setSelectedClassId('ALL');
                setSelectedSubjectId('ALL');
                setSelectedStatus('ALL');
                setSelectedDate('');
                setSearchQuery('');
              }}
              className="text-brand-600 dark:text-brand-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X size={12} /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {/* Teacher Filter (Privileged only) */}
          {isPrivileged && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Teacher</label>
              <select
                value={selectedTeacherId}
                onChange={e => setSelectedTeacherId(e.target.value)}
                className="input-field py-1.5 px-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 text-xs w-full"
              >
                <option value="ALL">All Teachers</option>
                {allTeachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Class Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Class</label>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="input-field py-1.5 px-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 text-xs w-full"
            >
              <option value="ALL">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              className="input-field py-1.5 px-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 text-xs w-full"
            >
              <option value="ALL">All Subjects</option>
              {availableSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="input-field py-1.5 px-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 text-xs w-full"
            >
              <option value="ALL">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted (Pending Approval)</option>
              <option value="Approved">Approved</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Test Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="input-field py-1.5 px-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 text-xs w-full"
            />
          </div>

          {/* Search Filter */}
          <div className={isPrivileged ? '' : 'sm:col-span-2'}>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Class, subject, teacher..."
                className="input-field py-1.5 pl-8 pr-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 text-xs w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Creation Modal / Inline Form */}
      {isCreating && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create New Weekly Test</h3>
            <button onClick={() => setIsCreating(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
              <X size={18} />
            </button>
          </div>
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
              <input 
                type="date" 
                required 
                className="input-field bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700" 
                value={newTest.test_date} 
                onChange={e => setNewTest({...newTest, test_date: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max Marks</label>
              <input 
                type="number" 
                required 
                min="1" 
                className="input-field bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700" 
                value={newTest.max_marks} 
                onChange={e => setNewTest({...newTest, max_marks: e.target.value})} 
              />
            </div>
            <div className="md:col-span-4 flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setIsCreating(false)} className="btn-hero-outline text-xs py-2 px-4">Cancel</button>
              <button type="submit" className="btn-hero-primary text-xs py-2 px-4">Create Test & Enter Marks</button>
            </div>
          </form>
        </div>
      )}

      {/* Tests Grid */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="animate-spin mx-auto text-brand-500 mb-2" size={24} />
          <p className="text-xs text-slate-400">Loading weekly tests...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredTests.map(test => {
            const tName = getTeacherDisplayName(test);
            const isSubmitted = test.status === 'Submitted';
            const isApproved = test.status === 'Approved';

            return (
              <div 
                key={test.id} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top card header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2.5 bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 rounded-xl">
                      <FileText size={20} />
                    </div>
                    
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border ${
                      test.status === 'Draft' 
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/50' 
                        : isSubmitted 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/50' 
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                    }`}>
                      {test.status === 'Draft' && <Clock size={11} />}
                      {isSubmitted && <AlertTriangle size={11} />}
                      {isApproved && <CheckCircle size={11} />}
                      {test.status}
                    </span>
                  </div>

                  {/* Title & Metadata */}
                  <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                    {test.classes?.name} {test.classes?.section || ''} — {test.subjects?.name}
                  </h3>

                  {/* Teacher info */}
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <User size={13} className="text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{tName}</span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Date: <strong className="text-slate-700 dark:text-slate-300">{test.test_date}</strong></span>
                    <span>Max: <strong className="text-slate-700 dark:text-slate-300">{test.max_marks}</strong></span>
                  </div>

                  {/* Progress info */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Evaluated: <strong className="text-slate-800 dark:text-slate-200">{test.marks_entered_count || 0}</strong> / {test.total_students_count || '—'}
                    </span>
                    {test.absent_count > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                        {test.absent_count} absent
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openTest(test)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        isPrivileged && isSubmitted
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                          : 'bg-brand-600 hover:bg-brand-500 text-white shadow'
                      }`}
                    >
                      {test.status === 'Draft' ? (
                        <><Edit size={14} /> Continue Marks Entry</>
                      ) : (
                        <><FileText size={14} /> View Marksheet</>
                      )}
                    </button>

                    {isPrivileged && isSubmitted && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApproveTest(test.id);
                        }}
                        className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                        title="Approve this test"
                      >
                        <CheckCircle size={14} /> Approve
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNoticeModalTest(test);
                    }}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Send size={12} /> Send Notice to Students
                  </button>
                </div>
              </div>
            );
          })}

          {filteredTests.length === 0 && (
            <div className="col-span-full text-center py-16 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
              <FileText size={48} className="mx-auto text-slate-400 dark:text-slate-600 mb-3" />
              <h4 className="text-base font-bold text-slate-700 dark:text-slate-300">No Weekly Tests Found</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {tests.length === 0 
                  ? 'No weekly tests have been created yet. Click "New Weekly Test" above to create one.' 
                  : 'No tests match your selected filter criteria. Try resetting or adjusting the filters.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Notice Publishing Modal */}
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
