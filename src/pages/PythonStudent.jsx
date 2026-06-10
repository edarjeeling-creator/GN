import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { BookOpen, Code, Trophy, Star, CheckCircle, Video, FileText, Copy } from 'lucide-react';
import PythonIDE from '../components/PythonIDE';

const highlightPython = (source) => {
  if (!source) return '';
  
  // Escape HTML characters
  let escaped = source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  const keywords = [
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 
    'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 
    'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 
    'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 
    'try', 'while', 'with', 'yield'
  ];
  
  const builtins = [
    'print', 'input', 'len', 'range', 'str', 'int', 'float', 'list', 
    'dict', 'set', 'tuple', 'bool', 'type', 'open', 'sum', 'min', 'max'
  ];

  const placeholders = [];
  let tokenCounter = 0;
  
  const addPlaceholder = (html) => {
    const token = `___TOKEN_${tokenCounter++}___`;
    placeholders.push({ token, html });
    return token;
  };
  
  // A. Protect Strings
  escaped = escaped.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, (match) => {
    return addPlaceholder(`<span style="color: #a3e635;">${match}</span>`);
  });
  
  escaped = escaped.replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, (match) => {
    return addPlaceholder(`<span style="color: #a3e635;">${match}</span>`);
  });
  
  // B. Protect Comments
  escaped = escaped.replace(/#[^\n]*/g, (match) => {
    return addPlaceholder(`<span style="color: #64748b; font-style: italic;">${match}</span>`);
  });
  
  // C. Color Def and Class definitions
  escaped = escaped.replace(/\b(def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, p1, p2) => {
    return `${addPlaceholder(`<span style="color: #f43f5e; font-weight: bold;">${p1}</span>`)} ${addPlaceholder(`<span style="color: #38bdf8; font-weight: bold;">${p2}</span>`)}`;
  });
  
  // D. Color Keywords
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    escaped = escaped.replace(regex, () => {
      return addPlaceholder(`<span style="color: #f43f5e; font-weight: bold;">${keyword}</span>`);
    });
  });
  
  // E. Color Builtins
  builtins.forEach(builtin => {
    const regex = new RegExp(`\\b${builtin}\\b`, 'g');
    escaped = escaped.replace(regex, () => {
      return addPlaceholder(`<span style="color: #38bdf8;">${builtin}</span>`);
    });
  });
  
  // F. Color Numbers
  escaped = escaped.replace(/\b\d+\b/g, (match) => {
    return addPlaceholder(`<span style="color: #fb923c;">${match}</span>`);
  });
  
  // Restore placeholders
  for (let i = placeholders.length - 1; i >= 0; i--) {
    escaped = escaped.replace(placeholders[i].token, placeholders[i].html);
  }
  
  return escaped;
};

const PythonStudent = () => {
  const { profile } = useAuth();
  const { students, classes } = useData();
  const [activeTab, setActiveTab] = useState('lessons'); // 'lessons', 'assignments', 'progress'
  const [lessons, setLessons] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  
  // Interaction State
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Student info 
  const [studentRecord, setStudentRecord] = useState(null);

  const studentData = students?.find(s => 
    s.id === profile?.id || 
    (profile?.uid && s.uid === profile?.uid) || 
    (profile?.name && s.name && s.name.trim().toLowerCase() === profile?.name.trim().toLowerCase())
  );
  const studentClass = classes?.find(c => c.id === studentData?.class_id);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    
    fetchLessons();
    fetchAssignments();
    if (profile?.id) {
      fetchStudentRecordAndSubmissions();
    }
    
    return () => window.removeEventListener('resize', handleResize);
  }, [profile]);

  const fetchLessons = async () => {
    const { data } = await supabase.from('python_lessons').select('*').order('created_at', { ascending: true });
    if (data) setLessons(data);
  };

  const fetchAssignments = async () => {
    const { data } = await supabase.from('python_assignments').select('*').order('created_at', { ascending: true });
    if (data) setAssignments(data);
  };

  const fetchStudentRecordAndSubmissions = async () => {
    if (profile && profile.role === 'student') {
      setStudentRecord(profile);
      const { data: subs } = await supabase.from('python_submissions').select('*, python_assignments(title, module)').eq('student_id', profile.id);
      if (subs) setMySubmissions(subs);
    } else {
      // Fallback/Legacy session checking for standard Supabase Auth
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email) {
        const uid = user.email.split('@')[0];
        const { data: student } = await supabase.from('students').select('*').eq('uid', uid).single();
        if (student) {
          setStudentRecord(student);
          const { data: subs } = await supabase.from('python_submissions').select('*, python_assignments(title, module)').eq('student_id', student.id);
          if (subs) setMySubmissions(subs);
        }
      }
    }
  };

  const handleSubmitAssignment = async (code, output) => {
    if (!selectedAssignment) return;
    
    if (!studentRecord) {
      alert("Test Mode: You are viewing the lab as an Administrator/Teacher. Code submissions are only saved to the database for logged-in Students.");
      return;
    }
    
    const { error } = await supabase.rpc('submit_student_code', {
      p_student_id: studentRecord.id,
      p_assignment_id: selectedAssignment.id,
      p_code: code
    });
    
    if (!error) {
      alert("Assignment submitted successfully!");
      fetchStudentRecordAndSubmissions();
      setSelectedAssignment(null);
    } else {
      alert("Error: " + error.message);
    }
  };

  const calculateBadges = () => {
    const badges = [];
    if (mySubmissions.length > 0) badges.push({ name: "First Program", icon: <Star className="text-yellow-400" />, desc: "Submitted your first Python code!" });
    if (mySubmissions.filter(s => s.status === 'reviewed' && s.marks >= 8).length > 0) badges.push({ name: "Top Scorer", icon: <Trophy className="text-yellow-500" />, desc: "Got 8+ marks on an assignment!" });
    if (mySubmissions.length >= 5) badges.push({ name: "Code Warrior", icon: <Code className="text-blue-500" />, desc: "Completed 5 assignments!" });
    return badges;
  };

  return (
    <>
      <div className="page-header bg-gradient-to-r from-blue-900 to-indigo-800 text-white p-8 rounded-xl mb-8">
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>Python Pathshala</h1>
          <p className="text-blue-200">
            Welcome to your coding journey, <span className="font-bold">{studentData?.name || profile?.name || 'Student'}!</span>
            {studentClass ? (
              <>
                {' | '}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Class {studentClass.name} {studentClass.section || ''}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', whiteSpace: 'nowrap' }} className="hide-scrollbar">
        <button 
          onClick={() => setActiveTab('lessons')} 
          style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'lessons' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'lessons' ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
        >
          <div className="flex items-center gap-2"><BookOpen size={18} /> My Lessons</div>
        </button>
        <button 
          onClick={() => setActiveTab('assignments')} 
          style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'assignments' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'assignments' ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
        >
          <div className="flex items-center gap-2"><Code size={18} /> Code Practice</div>
        </button>
        <button 
          onClick={() => setActiveTab('progress')} 
          style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'progress' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'progress' ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer' }}
        >
          <div className="flex items-center gap-2"><Trophy size={18} /> Progress Tracker</div>
        </button>
      </div>

      {activeTab === 'lessons' && (
        <div className="grid md:grid-cols-3 gap-6">
          {!isMobile ? (
            <div className="col-span-1 border-r border-slate-200 pr-4 mb-4 md:mb-0">
              <h3 className="font-bold text-lg mb-4 text-slate-700">Modules</h3>
              <div className="flex flex-col gap-2">
                {lessons.map((l, index) => (
                  <button 
                    key={l.id}
                    onClick={() => setSelectedLesson(l)}
                    className={`text-left p-3 rounded-lg transition-colors ${selectedLesson?.id === l.id ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'hover:bg-slate-50'}`}
                  >
                    <div className="font-bold text-sm">Lesson {index + 1}:</div>
                    <div className="text-md">{l.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{l.module}</div>
                  </button>
                ))}
                {lessons.length === 0 && <p className="text-slate-500 italic">No lessons available yet.</p>}
              </div>
            </div>
          ) : (
            <div className="col-span-1 mb-2">
              <h3 className="font-bold text-lg mb-2 text-slate-700">Select Module</h3>
              <select 
                className="input-field bg-white"
                value={selectedLesson?.id || ''}
                onChange={(e) => {
                  const lesson = lessons.find(l => l.id === e.target.value);
                  setSelectedLesson(lesson);
                }}
              >
                <option value="" disabled>Select a lesson to start...</option>
                {lessons.map((l, index) => (
                  <option key={l.id} value={l.id}>Lesson {index + 1}: {l.title}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="md:col-span-2 col-span-1 min-w-0">
            {selectedLesson ? (
              <div className="card p-4 md:p-8 bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <h2 className="text-3xl font-bold text-slate-800 mb-2">{selectedLesson.title}</h2>
                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold mb-6">{selectedLesson.module}</span>
                
                {selectedLesson.video_url && (
                  <div className="mb-6 p-4 bg-slate-50 rounded-lg flex items-start gap-3 border border-slate-200">
                    <Video className="text-red-500 mt-1" />
                    <div>
                      <h4 className="font-bold">Video Lesson</h4>
                      <a href={selectedLesson.video_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{selectedLesson.video_url}</a>
                    </div>
                  </div>
                )}
                
                <div className="prose max-w-full overflow-hidden">
                  <p className="text-slate-700 mb-6">{selectedLesson.description}</p>
                  
                  {selectedLesson.content && (
                    <div style={{ position: 'relative', marginTop: '1.5rem', maxWidth: '100%' }}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedLesson.content);
                          alert('Code copied to clipboard!');
                        }}
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.8rem',
                          transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                        title="Copy Code"
                      >
                        <Copy size={14} /> Copy
                      </button>
                      <pre 
                        style={{
                          backgroundColor: '#0b0f19',
                          color: '#cbd5e1',
                          padding: '1.5rem',
                          borderRadius: '8px',
                          border: '1px solid #1e293b',
                          overflowX: 'auto',
                          fontFamily: 'monospace',
                          fontSize: '14px',
                          lineHeight: '1.6',
                          whiteSpace: 'pre',
                          wordBreak: 'normal',
                          maxWidth: '100%',
                          margin: 0
                        }}
                        dangerouslySetInnerHTML={{ __html: highlightPython(selectedLesson.content) }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-4">
                <BookOpen size={48} className="opacity-20" />
                <p>Select a lesson from the menu to start learning!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="grid md:grid-cols-4 gap-6">
          {!isMobile ? (
            <div className="col-span-1 border-r border-slate-200 pr-4 mb-6 md:mb-0">
              <h3 className="font-bold text-lg mb-4 text-slate-700">Assignments</h3>
              <div className="flex flex-col gap-2">
                {assignments.map(a => {
                  const sub = mySubmissions.find(s => s.assignment_id === a.id);
                  return (
                    <button 
                      key={a.id}
                      onClick={() => setSelectedAssignment(a)}
                      className={`text-left p-3 rounded-lg transition-colors border ${selectedAssignment?.id === a.id ? 'bg-indigo-50 border-indigo-200' : 'border-transparent hover:bg-slate-50'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-slate-800">{a.title}</div>
                        {sub && <CheckCircle size={16} className="text-green-500 flex-shrink-0" />}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 truncate">{a.module}</div>
                    </button>
                  );
                })}
                {assignments.length === 0 && <p className="text-slate-500 italic">No assignments available yet.</p>}
              </div>
              
              <div className="mt-8">
                <h3 className="font-bold text-lg mb-4 text-slate-700">Free Practice IDE</h3>
                <p className="text-sm text-slate-600 mb-4">Want to just test some code? Click below for a blank editor.</p>
                <button 
                  onClick={() => setSelectedAssignment({ title: "Free Practice Playground", instructions: "Write and test whatever Python code you like! (This will not be submitted)", starter_code: 'print("Hello Python!")', isPlayground: true })}
                  className="w-full btn-hero-outline"
                >
                  Open Playground
                </button>
              </div>
            </div>
          ) : (
            <div className="col-span-1 mb-2">
              <h3 className="font-bold text-lg mb-2 text-slate-700">Select Assignment</h3>
              <select 
                className="input-field bg-white"
                value={selectedAssignment?.id || (selectedAssignment?.isPlayground ? 'playground' : '')}
                onChange={(e) => {
                  if (e.target.value === 'playground') {
                    setSelectedAssignment({ title: "Free Practice Playground", instructions: "Write and test whatever Python code you like! (This will not be submitted)", starter_code: 'print("Hello Python!")', isPlayground: true });
                  } else {
                    const assignment = assignments.find(a => a.id === e.target.value);
                    setSelectedAssignment(assignment);
                  }
                }}
              >
                <option value="" disabled>Select an assignment...</option>
                {assignments.map(a => {
                  const sub = mySubmissions.find(s => s.assignment_id === a.id);
                  const statusLabel = sub ? (sub.status === 'reviewed' ? ' - Reviewed' : ' - Submitted') : '';
                  return <option key={a.id} value={a.id}>{a.title}{statusLabel}</option>;
                })}
                <option value="playground">Free Practice Playground</option>
              </select>
            </div>
          )}
          
          <div className="md:col-span-3 col-span-1 min-w-0">
            {selectedAssignment ? (
              <div className="flex flex-col gap-4">
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">{selectedAssignment.title}</h2>
                  <p className="text-slate-600 bg-slate-50 p-4 rounded-md border border-slate-100">{selectedAssignment.instructions}</p>
                  
                  {/* Show previous submission feedback if any */}
                  {!selectedAssignment.isPlayground && mySubmissions.find(s => s.assignment_id === selectedAssignment.id)?.teacher_feedback && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                      <h4 className="font-bold text-yellow-800 flex items-center gap-2"><FileText size={16}/> Teacher Feedback:</h4>
                      <p className="text-yellow-700 mt-1">{mySubmissions.find(s => s.assignment_id === selectedAssignment.id).teacher_feedback}</p>
                    </div>
                  )}
                </div>
                
                {/* Python IDE */}
                <PythonIDE 
                  initialCode={!selectedAssignment.isPlayground && mySubmissions.find(s => s.assignment_id === selectedAssignment.id) ? mySubmissions.find(s => s.assignment_id === selectedAssignment.id).code : selectedAssignment.starter_code} 
                  height="450px" 
                  onSubmit={selectedAssignment.isPlayground ? null : handleSubmitAssignment}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-4">
                <Code size={48} className="opacity-20" />
                <p>Select an assignment to start coding!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'progress' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Trophy className="text-yellow-500"/> My Badges</h3>
            <div className="grid grid-cols-2 gap-4">
              {calculateBadges().map((b, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col items-center text-center">
                  <div className="bg-white p-3 rounded-full shadow-sm mb-3">{b.icon}</div>
                  <h4 className="font-bold text-slate-700">{b.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{b.desc}</p>
                </div>
              ))}
              {calculateBadges().length === 0 && (
                <div className="col-span-2 text-center text-slate-400 py-8">
                  <p>Submit your first assignment to earn a badge!</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="card p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-6">Submission History</h3>
            <div className="flex flex-col gap-3">
              {mySubmissions.map(s => (
                <div key={s.id} className="p-3 border-b border-slate-100 last:border-0">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-700">{s.python_assignments?.title}</div>
                      <div className="text-xs text-slate-500">{new Date(s.updated_at).toLocaleDateString()}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${s.status === 'reviewed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {s.status === 'reviewed' ? 'Reviewed' : 'Submitted'}
                        </span>
                        {s.marks !== null && (
                          <span className="font-bold text-lg text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                            {s.marks}/10
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {s.teacher_feedback && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm">
                      <strong className="text-yellow-800 flex items-center gap-1 mb-1"><FileText size={14}/> Teacher Message:</strong>
                      <span className="text-yellow-700">{s.teacher_feedback}</span>
                    </div>
                  )}
                </div>
              ))}
              {mySubmissions.length === 0 && (
                <p className="text-slate-400">No submissions yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PythonStudent;
