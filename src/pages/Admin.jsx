import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { Users, BookOpen, Shield, Layers, LogOut } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getConversionConstants } from './SubjectMarks';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import WebsiteCMS from '../components/WebsiteCMS';

const Admin = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { academicYear, classes, subjects, students, updateStudentLanguages, loadingData } = useData();
  const [stats, setStats] = useState({ classes: 0, students: 0, subjects: 0, teachers: 0 });
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [teachers, setTeachers] = useState([]);
  const [newTeacher, setNewTeacher] = useState({ name: '', email: '', password: '' });
  const [teacherMessage, setTeacherMessage] = useState({ type: '', text: '' });
  
  // State for Language Edit Modal
  const [editingLangStudent, setEditingLangStudent] = useState(null);
  const [editSecondLang, setEditSecondLang] = useState('');
  const [editThirdLang, setEditThirdLang] = useState('');
  const [editElectiveSubject, setEditElectiveSubject] = useState('');
  const [editSixthSubject, setEditSixthSubject] = useState('');

  const [newClass, setNewClass] = useState({ name: '', section: '' });
  const [newSubject, setNewSubject] = useState('');
  const [assignment, setAssignment] = useState({ teacher_id: '', class_id: '', subject_id: '' });
  
  const [managementSection, setManagementSection] = useState('overview');

  const [importClassId, setImportClassId] = useState('');
  const fileInputRef = useRef(null);

  const [flowsheetClassId, setFlowsheetClassId] = useState('');
  const [flowsheetTerm, setFlowsheetTerm] = useState('Finalterm');
  const flowsheetFileRef = useRef(null);

  const chartData = [
    { name: 'Class 6A', averageScore: 78, highestScore: 95 },
    { name: 'Class 7B', averageScore: 82, highestScore: 98 },
    { name: 'Class 8C', averageScore: 71, highestScore: 90 },
  ];

  useEffect(() => {
    fetchStats();
  }, [academicYear]);

  const fetchStats = async () => {
    const { data: clsData } = await supabase.from('classes').select('*').eq('academic_year', academicYear).order('name');
    const classIds = clsData ? clsData.map(c => c.id) : [];

    let studentCount = 0;
    if (classIds.length > 0) {
      const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).in('class_id', classIds);
      studentCount = count || 0;
    }

    const { count: subjectCount } = await supabase.from('subjects').select('*', { count: 'exact', head: true });
    const { count: teacherCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher');
    
    setStats({
      classes: classIds.length,
      students: studentCount,
      subjects: subjectCount || 0,
      teachers: teacherCount || 0
    });

    const { data: tData } = await supabase.from('profiles').select('*').eq('role', 'teacher').order('name');
    if (tData) setTeachers(tData);
  };



  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!newClass.name || !newClass.section) return;
    
    const { error } = await supabase.from('classes').insert([{ name: newClass.name, section: newClass.section, academic_year: academicYear }]);
    if (!error) {
      setNewClass({ name: '', section: '' });
      fetchStats();
    } else {
      alert("Error adding class: " + error.message);
    }
  };

  const handleDeleteClass = async (id) => {
    if (!window.confirm("Are you sure you want to delete this class? This will also delete all students, marks, and teacher assignments associated with it!")) return;
    
    const { error } = await supabase.from('classes').delete().match({ id });
    if (!error) {
      fetchStats();
    } else {
      alert("Error deleting class: " + error.message);
    }
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!newSubject) return;
    
    const { error } = await supabase.from('subjects').insert([{ name: newSubject }]);
    if (!error) {
      setNewSubject('');
      fetchStats();
    } else {
      alert("Error adding subject: " + error.message);
    }
  };

  const handleDeleteSubject = async (id) => {
    if (!window.confirm("Are you sure you want to delete this subject? This will also delete all marks and teacher assignments associated with it!")) return;
    
    const { error } = await supabase.from('subjects').delete().match({ id });
    if (!error) {
      fetchStats();
    } else {
      alert("Error deleting subject: " + error.message);
    }
  };

  const handleAssignTeacher = async (e) => {
    e.preventDefault();
    if (!assignment.teacher_id || !assignment.class_id || !assignment.subject_id) return;
    
    const { error } = await supabase.from('teacher_subjects').insert([assignment]);
    if (!error) {
      setAssignment({ teacher_id: '', class_id: '', subject_id: '' });
      alert("Teacher successfully assigned!");
    } else {
      alert("Error assigning teacher: " + error.message);
    }
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    setTeacherMessage({ type: '', text: '' });
    try {
      if (!newTeacher.name || !newTeacher.email || !newTeacher.password) {
        setTeacherMessage({ type: 'error', text: 'Please fill in all fields (Name, Email, Password).' });
        return;
      }
      
      const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
      const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseKey) {
        setTeacherMessage({ type: 'error', text: 'Configuration Error: Supabase Key is missing!' });
        return;
      }

      // Create secondary supabase client to avoid logging out admin
      const secondarySupabase = createClient(
        supabaseUrl,
        supabaseKey,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data, error } = await secondarySupabase.auth.signUp({
        email: newTeacher.email,
        password: newTeacher.password,
        options: {
          data: {
            name: newTeacher.name,
            role: 'teacher'
          }
        }
      });

      if (!error) {
        setNewTeacher({ name: '', email: '', password: '' });
        fetchStats();
        setTeacherMessage({ type: 'success', text: 'Teacher successfully added!' });
      } else {
        setTeacherMessage({ type: 'error', text: 'Error adding teacher: ' + error.message });
      }
    } catch (err) {
      setTeacherMessage({ type: 'error', text: 'Unexpected error: ' + err.message });
    }
  };

  const handleSaveLanguages = async () => {
    if (!editingLangStudent) return;
    await updateStudentLanguages(editingLangStudent.id, editSecondLang, editThirdLang, editElectiveSubject, editSixthSubject);
    setEditingLangStudent(null);
  };

  const handleFileUpload = () => {
    const file = fileInputRef.current?.files[0];
    if (!file) return alert('Please select a file first!');
    
    if (!importClassId) {
      alert("Please select a class first before uploading a file!");
      fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataArray = new Uint8Array(evt.target.result);
        const wb = XLSX.read(dataArray, { type: 'array' });
        
        let ws = null;
        let rawRows = [];
        
        // Loop through all sheets to find the one containing actual student data
        for (const sheetName of wb.SheetNames) {
          const currentWs = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(currentWs);
          if (rows.length > 0) {
            const firstRow = rows[0];
            // Check if keys in this sheet contain "name" or "roll" columns
            const hasName = Object.keys(firstRow).some(k => k.toLowerCase().replace(/[\s_\-.]/g, '').includes('name'));
            const hasRoll = Object.keys(firstRow).some(k => k.toLowerCase().replace(/[\s_\-.]/g, '').includes('roll') || k.toLowerCase().replace(/[\s_\-.]/g, '') === 'no');
            
            if (hasName && hasRoll) {
              ws = currentWs;
              rawRows = rows;
              break;
            }
          }
        }
        
        // Fallback to the first sheet if no sheets explicitly matched both headers
        if (!ws && wb.SheetNames.length > 0) {
          ws = wb.Sheets[wb.SheetNames[0]];
          rawRows = XLSX.utils.sheet_to_json(ws);
        }
        
        // Robust key matching helper to ignore capitalization, spacing, dots and underscores in headers
        const getRowValue = (row, possibleHeaders) => {
          const cleanHeaders = possibleHeaders.map(h => h.toLowerCase().replace(/[\s_\-.]/g, ''));
          for (const key of Object.keys(row)) {
            const cleanKey = key.toLowerCase().replace(/[\s_\-.]/g, '');
            if (cleanHeaders.includes(cleanKey)) {
              return row[key];
            }
          }
          return null;
        };

        const formattedStudents = rawRows.map(row => {
          const name = getRowValue(row, ['Name', 'Student Name', "Student's Name"]);
          const rollNo = getRowValue(row, ['Roll No', 'Roll Number', 'Roll', 'No', 'No.']);
          const secLang = getRowValue(row, ['2nd Language', 'Second Language', '2nd Lang']);
          const thirdLang = getRowValue(row, ['3rd Language', 'Third Language', '3rd Lang']);
          const uid = getRowValue(row, ['UID', 'Student UID', 'uid']);
          
          return {
            class_id: importClassId,
            name: name ? String(name).trim() : null,
            roll_no: rollNo ? parseInt(String(rollNo).trim(), 10) : NaN,
            second_language: secLang ? String(secLang).trim() : null,
            third_language: thirdLang ? String(thirdLang).trim() : null,
            uid: uid ? String(uid).trim() : null
          };
        }).filter(s => s.name && !isNaN(s.roll_no));

        if (formattedStudents.length === 0) {
          alert("No valid students found in the file. Ensure columns are named 'Name' and 'Roll No'.");
          return;
        }

        const { error } = await supabase.from('students').insert(formattedStudents);
        if (error) throw error;
        
        alert(`Successfully imported ${formattedStudents.length} students!`);
        fetchStats();
        
      } catch (err) {
        alert("Error parsing or uploading file: " + err.message);
      } finally {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUploadFlowsheet = () => {
    const file = flowsheetFileRef.current?.files[0];
    if (!file) return alert('Please select a file first!');
    if (!flowsheetClassId) return alert('Select a class first!');

    const cls = classes.find(c => c.id === flowsheetClassId);
    const { testMax } = getConversionConstants(cls?.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const { data: classStudents } = await supabase.from('students').select('*').eq('class_id', flowsheetClassId);
        
        const updates = [];
        let matchedSubjectsCount = 0;

        data.forEach(row => {
          const rollNo = row['No.'] || row['Roll No'] || row['Roll Number'] || row['roll no'] || row['Roll'];
          if (!rollNo) return;
          
          const student = classStudents.find(s => Number(s.roll_no) === Number(rollNo));
          if (!student) return;

          subjects.forEach(sub => {
            const excelHeader = Object.keys(row).find(
              key => key.trim().toLowerCase() === sub.name.trim().toLowerCase()
            );

            if (excelHeader && row[excelHeader] !== undefined && row[excelHeader] !== '') {
              matchedSubjectsCount++;
              const totalScore = Number(row[excelHeader]);
              
              const reversedExam = totalScore;
              const reversedTest = totalScore * (testMax / 100);

              updates.push({
                student_id: student.id,
                subject_id: sub.id,
                term: `${academicYear}_${flowsheetTerm}_Exam`,
                score: reversedExam
              });
              updates.push({
                student_id: student.id,
                subject_id: sub.id,
                term: `${academicYear}_${flowsheetTerm}_Test`,
                score: reversedTest
              });
            }
          });
        });

        if (updates.length > 0) {
          const { error } = await supabase.from('marks').upsert(updates, { onConflict: 'student_id, subject_id, term' });
          if (error) throw error;
          alert(`Successfully imported marks for ${data.length} students! Found and processed ${matchedSubjectsCount} subject scores.`);
        } else {
          alert('No valid marks found. Please ensure the column headers in your Excel file exactly match the Subject Names in the system!');
        }
      } catch (err) {
        alert("Error parsing or uploading file: " + err.message);
      } finally {
        flowsheetFileRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  if (loadingData) return <div>Loading Admin...</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <div className="page-header" style={{ borderBottom: 'none', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>Admin Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>System Management and Analytics</p>
        </div>
        <button
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1.25rem',
            borderRadius: '0.5rem',
            border: '1.5px solid #ef4444',
            background: 'transparent',
            color: '#ef4444',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.05)'
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = '#ef4444';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.2)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.05)';
          }}
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
        <button 
          onClick={() => setActiveTab('dashboard')} 
          style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'dashboard' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'dashboard' ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'dashboard' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem' }}
        >
          School Management
        </button>
        <button 
          onClick={() => setActiveTab('cms')} 
          style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'cms' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'cms' ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'cms' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem' }}
        >
          Website CMS
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
            <label style={{ fontWeight: 'bold', color: '#475569' }}>Select School Management Section:</label>
            <select 
              className="input-field" 
              value={managementSection} 
              onChange={e => setManagementSection(e.target.value)}
              style={{ minWidth: '250px', background: 'white', flex: 1, maxWidth: '400px' }}
            >
              <option value="overview">Overview & Analytics</option>
              <option value="users">Manage Users & Teachers</option>
              <option value="academics">Manage Classes & Subjects</option>
              <option value="data">Data Import & Export</option>
            </select>
          </div>

          {managementSection === 'overview' && (
            <>
              <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: '2rem' }}>
        <motion.div whileHover={{ y: -5 }} className="bento-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Total Classes</h3>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={20} />
            </div>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: 900, color: '#3b82f6', lineHeight: 1 }}>{stats.classes}</p>
        </motion.div>
        
        <motion.div whileHover={{ y: -5 }} className="bento-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Total Students</h3>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: 900, color: '#10b981', lineHeight: 1 }}>{stats.students}</p>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="bento-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Subjects</h3>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} />
            </div>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{stats.subjects}</p>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="bento-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Teachers</h3>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} />
            </div>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ef4444', lineHeight: 1 }}>{stats.teachers}</p>
        </motion.div>
      </div>
          <div className="bento-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Class Performance Analytics</h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Legend />
                  <Bar dataKey="averageScore" name="Average Score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="highestScore" name="Highest Score" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
            </>
          )}

          {managementSection === 'data' && (
            <div className="flex" style={{ flexDirection: 'column', gap: '2rem' }}>
          <div className="bento-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Bulk Import Students</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Select a class and upload an Excel (.xlsx or .csv) file with columns <strong>Name</strong> and <strong>Roll No</strong>.
            </p>
            <div className="flex flex-col gap-4">
              <select 
                className="input-field" 
                value={importClassId} 
                onChange={e => setImportClassId(e.target.value)}
              >
                <option value="">1. Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </select>

              <div className="flex gap-2">
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv"
                  ref={fileInputRef}
                  style={{ padding: '0.5rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', width: '100%', background: '#f8fafc' }}
                />
                <button className="btn-hero-primary" style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1rem' }} onClick={handleFileUpload}>
                  Import
                </button>
              </div>

              <button 
                className="btn-hero-outline" 
                style={{ border: '2px solid #e2e8f0', color: 'var(--text-primary)', marginTop: '1rem', width: '100%', padding: '0.75rem' }}
                onClick={async () => {
                  if (!importClassId) return alert('Select a class first!');
                  const { data } = await supabase.from('students').select('roll_no, name, second_language, third_language, uid').eq('class_id', importClassId).order('roll_no');
                  if (!data || data.length === 0) return alert('No students found!');
                  
                  const worksheet = XLSX.utils.json_to_sheet(data);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, "UIDs");
                  XLSX.writeFile(workbook, `Class_${importClassId}_UIDs.xlsx`);
                }}
              >
                Export Class UIDs
              </button>
            </div>
          </div>

          <div className="bento-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Bulk Import Historical Totals</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Upload your historical Flowsheet Excel directly. Ensure column headers exactly match Subject Names!
            </p>
            <div className="flex flex-col gap-4">
              <select 
                className="input-field" 
                value={flowsheetClassId} 
                onChange={e => setFlowsheetClassId(e.target.value)}
              >
                <option value="">1. Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </select>

              <select 
                className="input-field" 
                value={flowsheetTerm} 
                onChange={e => setFlowsheetTerm(e.target.value)}
              >
                <option value="Midterm">2. Mid-Term</option>
                <option value="Finalterm">2. Final-Term</option>
              </select>

              <div style={{ marginTop: '0.5rem' }}>
                <label className="text-sm font-bold block mb-2" style={{ color: 'var(--text-secondary)' }}>3. Upload Historical Excel</label>
                <div className="flex gap-2">
                  <input 
                    type="file" 
                    accept=".xlsx, .xls, .csv"
                    ref={flowsheetFileRef}
                    style={{ padding: '0.5rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', width: '100%', background: '#f8fafc' }}
                  />
                  <button className="btn-hero-primary" style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem' }} onClick={handleUploadFlowsheet}>
                    Import
                  </button>
                </div>
              </div>
            </div>
          </div>
            </div>
          )}

          {managementSection === 'users' && (
            <div className="flex" style={{ flexDirection: 'column', gap: '2rem' }}>
          <div className="bento-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Manage Students</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Roll</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Name</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Class</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.sort((a,b) => {
                    if (a.class_id !== b.class_id) return a.class_id.localeCompare(b.class_id);
                    return a.roll_no - b.roll_no;
                  }).map(s => {
                    const sCls = classes.find(c => c.id === s.class_id);
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem' }}>{s.roll_no}</td>
                        <td style={{ padding: '1rem', fontWeight: 500 }}>{s.name}</td>
                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{sCls ? `${sCls.name} ${sCls.section}` : 'Unknown'}</td>
                        <td style={{ padding: '1rem' }}>
                          <button 
                            className="btn-hero-outline"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', color: '#475569' }}
                            onClick={() => {
                              setEditingLangStudent(s);
                              setEditSecondLang(s.second_language || '');
                              setEditThirdLang(s.third_language || '');
                              setEditElectiveSubject(s.elective_subject || '');
                              setEditSixthSubject(s.sixth_subject || '');
                            }}
                          >
                            Edit Languages
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
            </div>
            </div>
          )}

          {managementSection === 'academics' && (
            <div className="flex" style={{ flexDirection: 'column', gap: '2rem' }}>
          <div className="bento-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Manage Classes</h3>
            <form onSubmit={handleAddClass} className="flex gap-2 mb-6">
              <input 
                type="text" 
                placeholder="Class Name" 
                className="input-field w-full" 
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                value={newClass.name}
                onChange={e => setNewClass({...newClass, name: e.target.value})}
                required
              />
              <input 
                type="text" 
                placeholder="Sec" 
                className="input-field" 
                style={{ width: '80px', background: '#f8fafc', border: '1px solid #e2e8f0' }}
                value={newClass.section}
                onChange={e => setNewClass({...newClass, section: e.target.value})}
                required
              />
              <button type="submit" className="btn-hero-primary" style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1.5rem' }}>Add</button>
            </form>
            
            <div style={{ maxHeight: '250px', overflowY: 'auto', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Class</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Section</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem', fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: '1rem' }}>{c.section}</td>
                      <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => window.location.href = `/classes/${c.id}/flowsheet`}
                          className="btn-hero-outline" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#3b82f6', border: '1px solid #bfdbfe' }}
                        >
                          Flowsheet
                        </button>
                        <button 
                          onClick={() => window.location.href = `/classes/${c.id}/reports`}
                          className="btn-hero-outline" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#10b981', border: '1px solid #a7f3d0' }}
                        >
                          Reports
                        </button>
                        <button 
                          onClick={() => handleDeleteClass(c.id)} 
                          className="btn-hero-outline" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#ef4444', border: '1px solid #fecaca' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {classes.length === 0 && <tr><td colSpan="3" style={{ padding: '1rem' }}>No classes found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bento-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Manage Subjects</h3>
            <form onSubmit={handleAddSubject} className="flex gap-2 mb-6">
              <input 
                type="text" 
                placeholder="Subject Name" 
                className="input-field w-full" 
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                required
              />
              <button type="submit" className="btn-hero-primary" style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1.5rem' }}>Add</button>
            </form>

            <div style={{ maxHeight: '250px', overflowY: 'auto', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Subject Name</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem', fontWeight: 500 }}>{s.name}</td>
                      <td style={{ padding: '1rem' }}>
                        <button 
                          onClick={() => handleDeleteSubject(s.id)} 
                          className="btn-hero-outline" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#ef4444', border: '1px solid #fecaca' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {subjects.length === 0 && <tr><td colSpan="2" style={{ padding: '1rem' }}>No subjects found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
            </div>
          )}

          {managementSection === 'users' && (
            <div className="flex" style={{ flexDirection: 'column', gap: '2rem' }}>
          <div className="bento-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Assign Teacher</h3>
            <form onSubmit={handleAssignTeacher} className="flex flex-col gap-3">
              <select 
                className="input-field" 
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                value={assignment.teacher_id} 
                onChange={e => setAssignment({...assignment, teacher_id: e.target.value})}
                required
              >
                <option value="">Select Teacher</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              
              <select 
                className="input-field" 
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                value={assignment.class_id} 
                onChange={e => setAssignment({...assignment, class_id: e.target.value})}
                required
              >
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </select>

              <select 
                className="input-field" 
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                value={assignment.subject_id} 
                onChange={e => setAssignment({...assignment, subject_id: e.target.value})}
                required
              >
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              <button type="submit" className="btn-hero-primary" style={{ background: '#8b5cf6', color: 'white', border: 'none', padding: '0.75rem', marginTop: '0.5rem' }}>Assign Teacher</button>
            </form>
          </div>

          <div className="bento-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Add New Teacher</h3>
            <div className="flex flex-col gap-3">
              <input 
                type="text" 
                placeholder="Full Name" 
                className="input-field" 
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                value={newTeacher.name}
                onChange={e => setNewTeacher({...newTeacher, name: e.target.value})}
              />
              <input 
                type="email" 
                placeholder="Email Address (Login ID)" 
                className="input-field" 
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                value={newTeacher.email}
                onChange={e => setNewTeacher({...newTeacher, email: e.target.value})}
              />
              <input 
                type="password" 
                placeholder="Secure Password" 
                className="input-field" 
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                value={newTeacher.password}
                onChange={e => setNewTeacher({...newTeacher, password: e.target.value})}
              />
              {teacherMessage.text && (
                <div style={{ padding: '0.75rem', borderRadius: '0.375rem', background: teacherMessage.type === 'error' ? '#fee2e2' : '#dcfce7', color: teacherMessage.type === 'error' ? '#991b1b' : '#166534', fontSize: '0.875rem' }}>
                  {teacherMessage.text}
                </div>
              )}
              <button type="button" onClick={handleAddTeacher} className="btn-hero-primary" style={{ background: '#059669', color: 'white', border: 'none', padding: '0.75rem', marginTop: '0.5rem' }}>Create Teacher Account</button>
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginTop: '2rem' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Name</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem', fontWeight: 500 }}>{t.name}</td>
                      <td style={{ padding: '1rem', color: '#64748b' }}>{t.email}</td>
                    </tr>
                  ))}
                  {teachers.length === 0 && <tr><td colSpan="2" style={{ padding: '1rem' }}>No teachers found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

            </div>
          )}
        </div>
      )}

      {editingLangStudent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '400px' }}>
            <h3 className="mb-4">Edit Languages: {editingLangStudent.name}</h3>
            <div className="mb-4">
              <label className="block mb-1">2nd Language (e.g. Nepali, Hindi, Bengali)</label>
              <input type="text" className="input-field w-full" value={editSecondLang} onChange={e => setEditSecondLang(e.target.value)} />
            </div>
            <div className="mb-4">
              <label className="block mb-1">3rd Language</label>
              <input type="text" className="input-field w-full" value={editThirdLang} onChange={e => setEditThirdLang(e.target.value)} />
            </div>
            <div className="mb-4">
              <label className="block mb-1">Elective Subject (e.g. Maths, EVS)</label>
              <input type="text" className="input-field w-full" value={editElectiveSubject} onChange={e => setEditElectiveSubject(e.target.value)} />
            </div>
            <div className="mb-4">
              <label className="block mb-1">6th Subject (e.g. Computer App, Home Science)</label>
              <input type="text" className="input-field w-full" value={editSixthSubject} onChange={e => setEditSixthSubject(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-outline" onClick={() => setEditingLangStudent(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveLanguages}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Website CMS */}
      {activeTab === 'cms' && <WebsiteCMS />}

    </motion.div>
  );
};

export default Admin;
