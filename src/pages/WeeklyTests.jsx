import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit, FileText, CheckCircle, Clock } from 'lucide-react';

export default function WeeklyTests() {
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  
  // Form State
  const [newTest, setNewTest] = useState({
    class_id: '',
    subject_id: '',
    test_date: new Date().toISOString().split('T')[0],
    max_marks: 20
  });

  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({}); // { student_id: { score: '', is_absent: false } }
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTests();
    fetchTeacherAssignments();
  }, []);

  const fetchTests = async () => {
    const { data } = await supabase
      .from('weekly_tests')
      .select(`
        *,
        classes (name),
        subjects (name)
      `)
      .eq('teacher_id', user.id)
      .order('test_date', { ascending: false });
    
    if (data) setTests(data);
  };

  const fetchTeacherAssignments = async () => {
    const { data } = await supabase
      .from('teacher_subjects')
      .select('class_id, subject_id, classes(name), subjects(name)')
      .eq('teacher_id', user.id);
    
    if (data) {
      // Extract unique classes and subjects
      const uniqueClasses = [];
      const uniqueSubjects = [];
      const classMap = new Set();
      const subjectMap = new Set();
      
      data.forEach(item => {
        if (!classMap.has(item.class_id)) {
          classMap.add(item.class_id);
          uniqueClasses.push({ id: item.class_id, name: item.classes.name });
        }
        if (!subjectMap.has(item.subject_id)) {
          subjectMap.add(item.subject_id);
          uniqueSubjects.push({ id: item.subject_id, name: item.subjects.name });
        }
      });
      
      setClasses(uniqueClasses);
      setSubjects(uniqueSubjects);
    }
  };

  const handleCreateTest = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('weekly_tests')
      .insert([{
        class_id: newTest.class_id,
        subject_id: newTest.subject_id,
        teacher_id: user.id,
        test_date: newTest.test_date,
        max_marks: newTest.max_marks,
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
      is_absent: marks[s.id].is_absent
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

    // Update test status if changing
    if (status !== selectedTest.status) {
      await supabase
        .from('weekly_tests')
        .update({ status })
        .eq('id', selectedTest.id);
    }

    setIsSubmitting(false);
    if (status === 'Submitted') {
      alert('Test submitted successfully to the Principal.');
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
            <h2 className="text-2xl font-bold">Weekly Test Marks Entry</h2>
            <p className="text-gray-600">
              Date: {selectedTest.test_date} | Max Marks: {selectedTest.max_marks} | Status: <span className="font-semibold">{selectedTest.status}</span>
            </p>
          </div>
          <button onClick={() => setSelectedTest(null)} className="btn-hero-outline">Back to List</button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 font-semibold text-gray-600">Roll No</th>
                <th className="p-4 font-semibold text-gray-600">Student Name</th>
                <th className="p-4 font-semibold text-gray-600">Marks Obtained</th>
                <th className="p-4 font-semibold text-gray-600 text-center">Absent</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4">{student.roll_no}</td>
                  <td className="p-4 font-medium">{student.name}</td>
                  <td className="p-4">
                    <input
                      type="number"
                      min="0"
                      max={selectedTest.max_marks}
                      disabled={isReadOnly || marks[student.id]?.is_absent}
                      value={marks[student.id]?.score || ''}
                      onChange={(e) => handleMarkChange(student.id, 'score', e.target.value)}
                      className="input-field w-32"
                      placeholder="e.g. 18"
                    />
                  </td>
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      disabled={isReadOnly}
                      checked={marks[student.id]?.is_absent || false}
                      onChange={(e) => handleMarkChange(student.id, 'is_absent', e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Weekly Tests</h2>
          <p className="text-gray-600">Manage and submit weekly test marks</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="btn-hero-primary flex items-center gap-2">
          <Plus size={20} /> New Test
        </button>
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
          <h3 className="text-lg font-bold mb-4">Create New Weekly Test</h3>
          <form onSubmit={handleCreateTest} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Class</label>
              <select required className="input-field" value={newTest.class_id} onChange={e => setNewTest({...newTest, class_id: e.target.value})}>
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <select required className="input-field" value={newTest.subject_id} onChange={e => setNewTest({...newTest, subject_id: e.target.value})}>
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Test Date</label>
              <input type="date" required className="input-field" value={newTest.test_date} onChange={e => setNewTest({...newTest, test_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Marks</label>
              <input type="number" required min="1" className="input-field" value={newTest.max_marks} onChange={e => setNewTest({...newTest, max_marks: e.target.value})} />
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
          <div key={test.id} className="bento-card bg-white p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openTest(test)}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <FileText size={24} />
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                test.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                test.status === 'Submitted' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
              }`}>
                {test.status === 'Draft' && <Clock size={12} />}
                {test.status === 'Submitted' && <CheckCircle size={12} />}
                {test.status === 'Approved' && <CheckCircle size={12} />}
                {test.status}
              </span>
            </div>
            <h3 className="font-bold text-lg">{test.classes?.name} - {test.subjects?.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{new Date(test.test_date).toLocaleDateString()}</p>
            
            <div className="flex items-center text-sm font-medium text-indigo-600 gap-1">
              {test.status === 'Draft' ? <><Edit size={16}/> Continue Editing</> : <><FileText size={16}/> View Marks</>}
            </div>
          </div>
        ))}
        {tests.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border border-gray-200 border-dashed">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No weekly tests found. Create your first one!</p>
          </div>
        )}
      </div>
    </div>
  );
}
