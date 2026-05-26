import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Layout from '../components/Layout';
import { BookOpen, FileCode2, Inbox, Plus, Edit, Trash2 } from 'lucide-react';
import PythonIDE from '../components/PythonIDE';

const MODULES = [
  "Module 1: Introduction to Coding",
  "Module 2: Print & Input",
  "Module 3: Variables",
  "Module 4: Conditions",
  "Module 5: Loops",
  "Module 6: Strings",
  "Module 7: Lists",
  "Module 8: Functions",
  "Module 9: Debugging",
  "Module 10: Final Mini Projects"
];

const PythonTeacher = () => {
  const [activeTab, setActiveTab] = useState('lessons'); // 'lessons', 'assignments', 'submissions'
  const [lessons, setLessons] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  
  // Forms
  const [newLesson, setNewLesson] = useState({ title: '', module: MODULES[0], description: '', video_url: '', content: '' });
  const [newAssignment, setNewAssignment] = useState({ title: '', module: MODULES[0], instructions: '', starter_code: '' });
  
  // Review Mode
  const [reviewingSubmission, setReviewingSubmission] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [marks, setMarks] = useState('');

  useEffect(() => {
    fetchLessons();
    fetchAssignments();
    fetchSubmissions();
  }, []);

  const fetchLessons = async () => {
    const { data } = await supabase.from('python_lessons').select('*').order('created_at', { ascending: false });
    if (data) setLessons(data);
  };

  const fetchAssignments = async () => {
    const { data } = await supabase.from('python_assignments').select('*').order('created_at', { ascending: false });
    if (data) setAssignments(data);
  };

  const fetchSubmissions = async () => {
    // We would join with students and assignments in a real scenario, but for now we'll fetch them.
    const { data, error } = await supabase
      .from('python_submissions')
      .select(`
        *,
        python_assignments (title, module),
        students (name, roll_no, uid)
      `)
      .order('created_at', { ascending: false });
    if (data) setSubmissions(data);
    if (error) console.error("Error fetching submissions", error);
  };

  const handleAddLesson = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('python_lessons').insert([newLesson]);
    if (!error) {
      setNewLesson({ title: '', module: MODULES[0], description: '', video_url: '', content: '' });
      fetchLessons();
      alert("Lesson added successfully!");
    } else {
      alert("Error: " + error.message);
    }
  };

  const handleDeleteLesson = async (id) => {
    if (!window.confirm("Delete this lesson?")) return;
    await supabase.from('python_lessons').delete().match({ id });
    fetchLessons();
  };

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('python_assignments').insert([newAssignment]);
    if (!error) {
      setNewAssignment({ title: '', module: MODULES[0], instructions: '', starter_code: '' });
      fetchAssignments();
      alert("Assignment added successfully!");
    } else {
      alert("Error: " + error.message);
    }
  };

  const handleDeleteAssignment = async (id) => {
    if (!window.confirm("Delete this assignment?")) return;
    await supabase.from('python_assignments').delete().match({ id });
    fetchAssignments();
  };

  const handleGradeSubmission = async () => {
    if (!reviewingSubmission) return;
    const { error } = await supabase.from('python_submissions').update({
      status: 'reviewed',
      teacher_feedback: feedback,
      marks: marks ? parseInt(marks) : null
    }).match({ id: reviewingSubmission.id });

    if (!error) {
      alert("Feedback saved!");
      setReviewingSubmission(null);
      fetchSubmissions();
    } else {
      alert("Error: " + error.message);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Python Teacher Portal</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage Coding Lessons & Assignments</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
        <button 
          onClick={() => setActiveTab('lessons')} 
          style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'lessons' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'lessons' ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
        >
          <div className="flex items-center gap-2"><BookOpen size={18} /> Lessons</div>
        </button>
        <button 
          onClick={() => setActiveTab('assignments')} 
          style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'assignments' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'assignments' ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
        >
          <div className="flex items-center gap-2"><FileCode2 size={18} /> Assignments</div>
        </button>
        <button 
          onClick={() => setActiveTab('submissions')} 
          style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'submissions' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'submissions' ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
        >
          <div className="flex items-center gap-2"><Inbox size={18} /> Submissions</div>
        </button>
      </div>

      {activeTab === 'lessons' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card" style={{ padding: '2rem' }}>
            <h3 className="text-xl font-bold mb-4">Create New Lesson</h3>
            <form onSubmit={handleAddLesson} className="flex flex-col gap-4">
              <input className="input-field" placeholder="Lesson Title" value={newLesson.title} onChange={e => setNewLesson({...newLesson, title: e.target.value})} required />
              <select className="input-field" value={newLesson.module} onChange={e => setNewLesson({...newLesson, module: e.target.value})}>
                {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <textarea className="input-field" placeholder="Lesson Description / Learning Objectives" rows={3} value={newLesson.description} onChange={e => setNewLesson({...newLesson, description: e.target.value})}></textarea>
              <input className="input-field" placeholder="YouTube Video URL (optional)" value={newLesson.video_url} onChange={e => setNewLesson({...newLesson, video_url: e.target.value})} />
              <textarea className="input-field" placeholder="Markdown/Text Content" rows={6} value={newLesson.content} onChange={e => setNewLesson({...newLesson, content: e.target.value})}></textarea>
              <button type="submit" className="btn-hero-primary" style={{ background: 'var(--primary-color)', color: 'white', border: 'none' }}><Plus size={16} className="inline mr-2" /> Publish Lesson</button>
            </form>
          </div>

          <div className="card" style={{ padding: '2rem' }}>
            <h3 className="text-xl font-bold mb-4">Uploaded Lessons</h3>
            <div className="flex flex-col gap-3">
              {lessons.map(l => (
                <div key={l.id} className="p-4 border rounded-md shadow-sm">
                  <div className="flex justify-between">
                    <h4 className="font-bold text-lg">{l.title}</h4>
                    <button onClick={() => handleDeleteLesson(l.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                  </div>
                  <p className="text-xs text-blue-600 mb-2">{l.module}</p>
                  <p className="text-sm text-slate-600">{l.description}</p>
                </div>
              ))}
              {lessons.length === 0 && <p className="text-slate-500">No lessons uploaded yet.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card" style={{ padding: '2rem' }}>
            <h3 className="text-xl font-bold mb-4">Create Assignment</h3>
            <form onSubmit={handleAddAssignment} className="flex flex-col gap-4">
              <input className="input-field" placeholder="Assignment Title" value={newAssignment.title} onChange={e => setNewAssignment({...newAssignment, title: e.target.value})} required />
              <select className="input-field" value={newAssignment.module} onChange={e => setNewAssignment({...newAssignment, module: e.target.value})}>
                {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <textarea className="input-field" placeholder="Instructions (e.g. Write a program to...)" rows={4} value={newAssignment.instructions} onChange={e => setNewAssignment({...newAssignment, instructions: e.target.value})} required></textarea>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Starter Code (Optional)</label>
                <PythonIDE initialCode={newAssignment.starter_code} height="200px" onSave={(code) => setNewAssignment({...newAssignment, starter_code: code})} />
              </div>
              <button type="submit" className="btn-hero-primary" style={{ background: '#10b981', color: 'white', border: 'none' }}><Plus size={16} className="inline mr-2" /> Post Assignment</button>
            </form>
          </div>

          <div className="card" style={{ padding: '2rem' }}>
            <h3 className="text-xl font-bold mb-4">Active Assignments</h3>
            <div className="flex flex-col gap-3">
              {assignments.map(a => (
                <div key={a.id} className="p-4 border rounded-md shadow-sm">
                  <div className="flex justify-between">
                    <h4 className="font-bold text-lg">{a.title}</h4>
                    <button onClick={() => handleDeleteAssignment(a.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                  </div>
                  <p className="text-xs text-blue-600 mb-2">{a.module}</p>
                  <p className="text-sm text-slate-600">{a.instructions}</p>
                </div>
              ))}
              {assignments.length === 0 && <p className="text-slate-500">No assignments created yet.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'submissions' && (
        <div className="card" style={{ padding: '2rem' }}>
          {reviewingSubmission ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Reviewing Code: {reviewingSubmission.students?.name}</h3>
                <button onClick={() => setReviewingSubmission(null)} className="btn btn-outline text-sm">Close Review</button>
              </div>
              <p className="text-sm text-blue-600 mb-4">Assignment: {reviewingSubmission.python_assignments?.title}</p>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-2">Student's Code (Run to test)</label>
                  <PythonIDE initialCode={reviewingSubmission.code} height="350px" />
                </div>
                <div className="flex flex-col gap-4">
                  <div className="bg-slate-100 p-4 rounded-md">
                    <label className="block font-bold text-slate-700 mb-2">Provide Feedback</label>
                    <textarea 
                      className="input-field w-full" 
                      rows={6} 
                      placeholder="e.g. Good logic! But you missed a colon on line 4."
                      value={feedback}
                      onChange={e => setFeedback(e.target.value)}
                    ></textarea>
                  </div>
                  <div className="bg-slate-100 p-4 rounded-md">
                    <label className="block font-bold text-slate-700 mb-2">Grade (Marks)</label>
                    <input 
                      type="number" 
                      className="input-field w-full" 
                      placeholder="e.g. 10"
                      value={marks}
                      onChange={e => setMarks(e.target.value)}
                    />
                  </div>
                  <button onClick={handleGradeSubmission} className="btn-hero-primary" style={{ background: '#3b82f6', color: 'white', border: 'none' }}>
                    <CheckCircle size={16} className="inline mr-2" /> Save Review
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-xl font-bold mb-4">Student Submissions</h3>
              <table className="data-table w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3 text-left">Student</th>
                    <th className="p-3 text-left">Assignment</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(sub => (
                    <tr key={sub.id} className="border-b border-slate-100">
                      <td className="p-3 font-medium">{sub.students?.name} <span className="text-xs text-slate-400">({sub.students?.uid})</span></td>
                      <td className="p-3">{sub.python_assignments?.title}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${sub.status === 'reviewed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {sub.status === 'reviewed' ? 'Reviewed' : 'Needs Review'}
                        </span>
                      </td>
                      <td className="p-3">
                        <button 
                          onClick={() => {
                            setReviewingSubmission(sub);
                            setFeedback(sub.teacher_feedback || '');
                            setMarks(sub.marks || '');
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1"
                        >
                          <Edit size={14} /> Review Code
                        </button>
                      </td>
                    </tr>
                  ))}
                  {submissions.length === 0 && <tr><td colSpan="4" className="p-4 text-center text-slate-500">No submissions yet.</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

    </Layout>
  );
};

export default PythonTeacher;
