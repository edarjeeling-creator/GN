import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase, getClientSchoolId } from '../lib/supabase';
import { motion } from 'framer-motion';
import { Users, BookOpen, Shield, Layers, LogOut, QrCode, ShieldCheck } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { getConversionConstants } from './SubjectMarks';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import WebsiteCMS from '../components/WebsiteCMS';
import BatchPhotoImport from './Admin/BatchPhotoImport';
import RoutineGenerator from './Admin/RoutineGenerator';
import SubstitutionDashboard from './Admin/SubstitutionDashboard';
import FeatureSettings from './Admin/FeatureSettings';
import IDCardGenerator from './Admin/IDCardGenerator';
import TeacherIDCardGenerator from './Admin/TeacherIDCardGenerator';
import MarksManager from './Admin/MarksManager';
import ImportHistory from './Admin/ImportHistory';
import ReportCardCMS from './Admin/ReportCardCMS';
import AuditLog from './Admin/AuditLog';
import ResultStatusManager from './Admin/ResultStatusManager';

const Admin = () => {
  const { logout, profile } = useAuth();
  const navigate = useNavigate();
  const { academicYear, classes, subjects, students, updateStudentName, updateStudentLanguages, updateStudentPictureUrl, updateSubjectName, removeStudent, loadingData } = useData();
  const [stats, setStats] = useState({ classes: 0, students: 0, subjects: 0, teachers: 0 });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [idCardTab, setIdCardTab] = useState('student');
  
  const [teachers, setTeachers] = useState([]);
  const [newTeacher, setNewTeacher] = useState({ name: '', email: '', password: '' });
  const [teacherMessage, setTeacherMessage] = useState({ type: '', text: '' });
  
  // State for Language Edit Modal
  const [editingLangStudent, setEditingLangStudent] = useState(null);
  const [editSecondLang, setEditSecondLang] = useState('');
  const [editThirdLang, setEditThirdLang] = useState('');
  const [editElectiveSubject, setEditElectiveSubject] = useState('');
  const [editSixthSubject, setEditSixthSubject] = useState('');

  // State for Edit Teacher Modal
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [editTeacherName, setEditTeacherName] = useState('');
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [modalAssignmentClass, setModalAssignmentClass] = useState('');
  const [modalAssignmentSubject, setModalAssignmentSubject] = useState('');

  const [uploadingStudentId, setUploadingStudentId] = useState(null);
  const studentPhotoInputRef = useRef(null);
  const [manageStudentsClassFilter, setManageStudentsClassFilter] = useState('all');

  const [newClass, setNewClass] = useState({ name: '', section: '' });
  const [newSubject, setNewSubject] = useState('');
  
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  
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

  const handleStudentPhotoClick = (studentId) => {
    setUploadingStudentId(studentId);
    studentPhotoInputRef.current.click();
  };

  const handleStudentPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingStudentId) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be less than 2MB.");
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${uploadingStudentId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('student-profiles')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('student-profiles')
        .getPublicUrl(fileName);

      const pictureUrl = publicUrlData.publicUrl;

      const { error: dbError } = await supabase
        .from('students')
        .update({ picture_url: pictureUrl })
        .eq('id', uploadingStudentId);

      if (dbError) throw dbError;

      updateStudentPictureUrl(uploadingStudentId, pictureUrl);
      alert("Photo uploaded successfully!");
    } catch (err) {
      console.error(err);
      alert("Error uploading photo: " + err.message);
    } finally {
      if (studentPhotoInputRef.current) studentPhotoInputRef.current.value = '';
      setUploadingStudentId(null);
    }
  };

  const fetchTeacherAssignments = async (teacherId) => {
    const { data, error } = await supabase.from('teacher_subjects').select('*').eq('teacher_id', teacherId);
    if (data) setTeacherAssignments(data);
    else console.error("Error fetching assignments:", error);
  };

  const handleEditTeacherClick = (teacher) => {
    setEditingTeacher(teacher);
    setEditTeacherName(teacher.name);
    fetchTeacherAssignments(teacher.id);
  };

  const handleUpdateTeacherName = async () => {
    if (!editingTeacher || !editTeacherName.trim()) return;
    const { error } = await supabase.from('profiles').update({ name: editTeacherName.trim(), full_name: editTeacherName.trim() }).eq('id', editingTeacher.id);
    if (!error) {
      setTeachers(prev => prev.map(t => t.id === editingTeacher.id ? { ...t, name: editTeacherName.trim() } : t));
      alert("Teacher name updated successfully!");
    } else {
      alert("Error updating teacher name: " + error.message);
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    if (!window.confirm("Are you sure you want to remove this assignment?")) return;
    const { error } = await supabase.from('teacher_subjects').delete().eq('id', assignmentId);
    if (!error) {
      setTeacherAssignments(prev => prev.filter(a => a.id !== assignmentId));
    } else {
      alert("Error removing assignment: " + error.message);
    }
  };

  const handleModalAssignTeacher = async () => {
    if (!editingTeacher || !modalAssignmentClass || !modalAssignmentSubject) return;
    
    // Check for duplicates
    const isDuplicate = teacherAssignments.some(a => a.class_id === modalAssignmentClass && a.subject_id === modalAssignmentSubject);
    if (isDuplicate) {
      alert("This subject is already assigned to this class for this teacher.");
      return;
    }

    const newAssignment = { teacher_id: editingTeacher.id, class_id: modalAssignmentClass, subject_id: modalAssignmentSubject };
    const { data, error } = await supabase.from('teacher_subjects').upsert([newAssignment], { onConflict: 'teacher_id,class_id,subject_id' }).select();
    if (!error && data) {
      setTeacherAssignments(prev => [...prev, data[0]]);
      setModalAssignmentClass('');
      setModalAssignmentSubject('');
    } else {
      alert("Error assigning subject: " + error.message);
    }
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!newClass.name) return;
    
    const { error } = await supabase.from('classes').insert([{ name: newClass.name, section: newClass.section || '', academic_year: academicYear }]);
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
    } else if (error) alert("Error deleting class: " + error.message);
  };

  const handleDeleteSubject = async (id) => {
    if (!window.confirm("Are you sure you want to delete this subject?")) return;
    
    const { error } = await supabase.from('subjects').delete().match({ id });
    if (!error) {
      fetchStats();
    } else {
      alert("Error deleting subject: " + error.message);
    }
  };

  const handleEditStudentName = async (student) => {
    const newSpelling = window.prompt("Enter the correct spelling for the student's name:", student.name);
    if (!newSpelling || newSpelling.trim() === '' || newSpelling === student.name) return;
    
    const cleanName = newSpelling.trim();
    const { error } = await supabase.from('students').update({ name: cleanName }).eq('id', student.id);
    if (!error) {
      updateStudentName(student.id, cleanName);
    } else {
      alert("Error updating student name: " + error.message);
    }
  };

  const handleDeleteStudent = async (id) => {
    if (!window.confirm("Are you sure you want to delete this student? All their marks and attendance records will be removed forever!")) return;

    const { error } = await supabase.from('students').delete().match({ id });
    if (!error) {
      removeStudent(id);
      alert("Student deleted successfully!");
    } else {
      alert("Error deleting student: " + error.message);
    }
  };

  const handleBulkDeleteStudents = async () => {
    if (manageStudentsClassFilter === 'all') {
      alert("Please select a specific class to delete its students.");
      return;
    }
    const selectedClass = classes.find(c => c.id === manageStudentsClassFilter);
    const className = selectedClass ? `${selectedClass.name} ${selectedClass.section}` : 'this class';
    
    if (!window.confirm(`DANGER: Are you absolutely sure you want to delete ALL students in ${className}? All their marks and attendance records will be permanently removed! This action cannot be undone.`)) return;

    const { error } = await supabase.from('students').delete().match({ class_id: manageStudentsClassFilter });
    if (!error) {
      alert(`All students in ${className} have been deleted.`);
      window.location.reload(); // Force full refresh to clear context state
    } else {
      alert("Error deleting students: " + error.message);
    }
  };

  const handleDeleteTeacher = async (id) => {
    if (!window.confirm("Are you sure you want to delete this teacher? This will also remove their assignments forever!")) return;

    const { error } = await supabase.from('profiles').delete().match({ id });
    if (!error) {
      setTeachers(prev => prev.filter(t => t.id !== id));
      alert("Teacher deleted successfully!");
    } else {
      alert("Error deleting teacher: " + error.message);
    }
  };

  const handleEditSubjectSave = async (subjectId) => {
    if (!editSubjectName.trim()) {
      alert("Subject name cannot be empty.");
      return;
    }
    const { error } = await supabase.from('subjects').update({ name: editSubjectName }).eq('id', subjectId);
    if (error) {
      alert("Error updating subject: " + error.message);
    } else {
      updateSubjectName(subjectId, editSubjectName);
      setEditingSubjectId(null);
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


  const handleAssignTeacher = async (e) => {
    e.preventDefault();
    if (!assignment.teacher_id || !assignment.class_id || !assignment.subject_id) return;
    
    const { error } = await supabase.from('teacher_subjects').upsert([assignment], { onConflict: 'teacher_id,class_id,subject_id' });
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
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://grades.gyanodayniketan.cloud';
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
            full_name: newTeacher.name,
            role: 'teacher',
            school_id: getClientSchoolId()
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
          const rollKey = Object.keys(row).find(k => {
             const clean = k.toLowerCase().replace(/[\s_\-.]/g, '');
             return clean === 'rollno' || clean === 'roll' || clean === 'rollnumber' || clean === 'no';
          });
          const rollNo = rollKey ? row[rollKey] : null;
          if (!rollNo) return;
          
          const student = classStudents.find(s => Number(s.roll_no) === Number(rollNo));
          if (!student) return;

          const subjectClusters = [
            ['english 1', 'english paper 1', 'eng1', 'eng 1', 'english i', 'english-1'],
            ['english 2', 'english paper 2', 'eng2', 'eng 2', 'english ii', 'english-2'],
            ['second language', 'geng', '2nd lang', 'second lang', 'general english', '2nd language'],
            ['nepali', 'nep', 'nepal'],
            ['hindi', 'hin'],
            ['mathematics', 'math', 'maths'],
            ['physics', 'phy', 'phys'],
            ['chemistry', 'chem'],
            ['biology', 'bio', 'biol'],
            ['physical education', 'pe', 'physical ed'],
            ['economics', 'eco', 'econ'],
            ['history', 'hist', 'his'],
            ['geography', 'geog', 'geo'],
            ['political science', 'pol sc', 'pol. sc.', 'pol science', 'polsc'],
            ['sociology', 'soc', 'socio']
          ];

          subjects.forEach(sub => {
            const normalizedSubName = sub.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

            const excelHeader = Object.keys(row).find(key => {
              const normalizedKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
              if (normalizedKey === normalizedSubName) return true;
              
              for (const cluster of subjectClusters) {
                 const cleanCluster = cluster.map(c => c.replace(/[^a-z0-9]/g, ''));
                 if (cleanCluster.includes(normalizedSubName) && cleanCluster.includes(normalizedKey)) {
                    return true;
                 }
              }
              
              if (normalizedKey.length >= 4 && normalizedSubName.includes(normalizedKey)) return true;
              if (normalizedSubName.length >= 4 && normalizedKey.includes(normalizedSubName)) return true;

              return false;
            });

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
          // Log to import history first to get the import session ID
          const { data: importSession, error: importError } = await supabase.from('import_history').insert({
            file_name: file.name,
            user_id: profile?.id,
            user_name: profile?.name,
            record_count: matchedSubjectsCount,
            status: 'Success',
            academic_year: academicYear,
            term: flowsheetTerm,
            class_id: flowsheetClassId
          }).select().single();

          if (importError) throw importError;

          // Attach import_id to marks
          const finalUpdates = updates.map(u => ({ ...u, import_id: importSession.id, deleted_at: null, deleted_by: null }));

          const { error } = await supabase.from('marks').upsert(finalUpdates, { onConflict: 'student_id, subject_id, term' });
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
        <button 
          onClick={() => setActiveTab('portal_settings')} 
          style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'portal_settings' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'portal_settings' ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'portal_settings' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem' }}
        >
          Portal Settings
        </button>
        <button 
          onClick={() => setActiveTab('id_cards')} 
          style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'id_cards' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'id_cards' ? 'var(--primary-color)' : 'var(--text-secondary)', fontWeight: activeTab === 'id_cards' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem' }}
        >
          ID Cards
        </button>
      </div>

      {activeTab === 'portal_settings' && (
        <FeatureSettings teachers={teachers} />
      )}

      {activeTab === 'id_cards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            <button
              onClick={() => setIdCardTab('student')}
              style={{
                padding: '0.5rem 1rem',
                background: idCardTab === 'student' ? 'var(--primary-color)' : 'transparent',
                color: idCardTab === 'student' ? 'white' : '#64748b',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Student ID Cards
            </button>
            <button
              onClick={() => setIdCardTab('teacher')}
              style={{
                padding: '0.5rem 1rem',
                background: idCardTab === 'teacher' ? 'var(--primary-color)' : 'transparent',
                color: idCardTab === 'teacher' ? 'white' : '#64748b',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Teacher ID Cards
            </button>
          </div>
          {idCardTab === 'student' ? (
            <IDCardGenerator classes={classes} students={students} fetchStats={fetchStats} />
          ) : (
            <TeacherIDCardGenerator teachers={teachers} fetchStats={fetchStats} />
          )}
        </div>
      )}

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
              <option value="routine">Routine & Substitution Engine</option>
              <option value="data">Data Import & Export</option>
              <option value="marks">Marks Manager</option>
              <option value="report_cms">Report Configuration (CMS)</option>
              <option value="audit">Marks Audit Log</option>
              <option value="publishing">Result Publishing & Locking</option>
            </select>
          </div>

          {managementSection === 'audit' && (
            <AuditLog />
          )}

          {managementSection === 'publishing' && (
            <ResultStatusManager classes={classes} academicYear={academicYear} profile={profile} />
          )}

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
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3 mb-4">
              <ShieldCheck className="text-indigo-600" size={32} />
              System Administration
            </h1>
            <Link 
              to="/kiosk/attendance" 
              target="_blank"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-sm mb-6"
            >
              <QrCode size={20} />
              Open QR Attendance Scanner
            </Link>
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
                <option value="Midterm">2. Term (Mid-Term)</option>
                <option value="Finalterm">2. Term (Final-Term)</option>
                <option value="Unit">2. Term (Unit Test)</option>
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

          <ImportHistory academicYear={academicYear} />

            </div>
          )}

          {managementSection === 'users' && (
            <div className="flex" style={{ flexDirection: 'column', gap: '2rem' }}>
          <div className="bento-card" style={{ padding: '2rem' }}>
            <div className="flex justify-between items-center mb-6" style={{ flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Manage Students</h3>
              <div className="flex gap-2 items-center">
                <select 
                  className="input-field" 
                  style={{ maxWidth: '250px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}
                  value={manageStudentsClassFilter}
                  onChange={(e) => setManageStudentsClassFilter(e.target.value)}
                >
                  <option value="all">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                </select>
                {manageStudentsClassFilter !== 'all' && (
                  <button 
                    onClick={handleBulkDeleteStudents}
                    className="btn-danger" 
                    style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', background: '#ef4444', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Delete Entire Class
                  </button>
                )}
              </div>
            </div>
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
                  {students.filter(s => manageStudentsClassFilter === 'all' || s.class_id === manageStudentsClassFilter).sort((a,b) => {
                    if (a.class_id !== b.class_id) return a.class_id.localeCompare(b.class_id);
                    return a.roll_no - b.roll_no;
                  }).map(s => {
                    const sCls = classes.find(c => c.id === s.class_id);
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem' }}>{s.roll_no}</td>
                        <td style={{ padding: '1rem' }}>
                          <div className="flex items-center gap-3">
                            <img 
                              src={s.picture_url ? `${s.picture_url}?t=${Date.now()}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random`} 
                              alt={s.name} 
                              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                            <span style={{ fontWeight: 500 }}>{s.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{sCls ? `${sCls.name} ${sCls.section}` : 'Unknown'}</td>
                        <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button 
                            className="btn-hero-outline"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', color: '#475569' }}
                            onClick={() => handleStudentPhotoClick(s.id)}
                            disabled={uploadingStudentId === s.id}
                          >
                            {uploadingStudentId === s.id ? 'Uploading...' : 'Upload Photo'}
                          </button>
                          <button 
                            className="btn-hero-outline"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', color: '#475569' }}
                            onClick={() => handleEditStudentName(s)}
                          >
                            Edit Name
                          </button>
                          <button 
                            className="btn btn-outline"
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
                          <button 
                            className="btn btn-outline"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: '1px solid #ef4444', color: '#ef4444' }}
                            onClick={() => handleDeleteStudent(s.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
            </div>

            <BatchPhotoImport 
              students={students} 
              classes={classes} 
              onUploadSuccess={(id, url) => updateStudentPictureUrl(id, url)} 
            />

            </div>
          )}

          {managementSection === 'marks' && (
            <MarksManager 
              classes={classes} 
              subjects={subjects} 
              academicYear={academicYear} 
            />
          )}

          {managementSection === 'report_cms' && (
            <ReportCardCMS />
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
                      <td style={{ padding: '1rem', fontWeight: 500 }}>
                        {editingSubjectId === s.id ? (
                          <input 
                            type="text" 
                            className="input-field w-full"
                            style={{ padding: '0.4rem', border: '1px solid var(--primary-color)' }}
                            value={editSubjectName}
                            onChange={(e) => setEditSubjectName(e.target.value)}
                          />
                        ) : (
                          s.name
                        )}
                      </td>
                      <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                        {editingSubjectId === s.id ? (
                          <>
                            <button 
                              onClick={() => handleEditSubjectSave(s.id)}
                              className="btn-hero-outline" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#10b981', border: '1px solid #a7f3d0' }}
                            >
                              Save
                            </button>
                            <button 
                              onClick={() => setEditingSubjectId(null)}
                              className="btn-hero-outline" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#64748b', border: '1px solid #cbd5e1' }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => {
                                setEditingSubjectId(s.id);
                                setEditSubjectName(s.name);
                              }}
                              className="btn-hero-outline" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#3b82f6', border: '1px solid #bfdbfe' }}
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteSubject(s.id)} 
                              className="btn-hero-outline" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#ef4444', border: '1px solid #fecaca' }}
                            >
                              Delete
                            </button>
                          </>
                        )}
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
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem', fontWeight: 500 }}>{t.name}</td>
                      <td style={{ padding: '1rem', color: '#64748b' }}>{t.email}</td>
                      <td style={{ padding: '1rem' }}>
                        <button 
                          className="btn-hero-outline"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', color: '#475569' }}
                          onClick={() => handleEditTeacherClick(t)}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn-hero-outline"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: '1px solid #ef4444', color: '#ef4444' }}
                          onClick={() => handleDeleteTeacher(t.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {teachers.length === 0 && <tr><td colSpan="3" style={{ padding: '1rem' }}>No teachers found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

            </div>
          )}

          {managementSection === 'routine' && (
            <div className="flex flex-col gap-6 w-full">
              <RoutineGenerator classes={classes} subjects={subjects} profiles={teachers} />
              <SubstitutionDashboard classes={classes} subjects={subjects} profiles={teachers} />
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

      {editingTeacher && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 className="mb-4 text-xl font-bold">Edit Teacher: {editingTeacher.name}</h3>
            
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block mb-2 font-semibold">Teacher Name</label>
              <div className="flex gap-2">
                <input type="text" className="input-field flex-1" style={{ background: 'white', border: '1px solid #e2e8f0' }} value={editTeacherName} onChange={e => setEditTeacherName(e.target.value)} />
                <button className="btn btn-primary" style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem' }} onClick={handleUpdateTeacherName}>Save Name</button>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-semibold mb-2">Current Assignments</h4>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.375rem' }}>
                <table className="data-table" style={{ width: '100%' }}>
                  <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '0.875rem' }}>Class</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '0.875rem' }}>Subject</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '0.875rem' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherAssignments.map(a => {
                      const cls = classes.find(c => c.id === a.class_id);
                      const sub = subjects.find(s => s.id === a.subject_id);
                      return (
                        <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem', fontSize: '0.875rem' }}>{cls ? `${cls.name} ${cls.section}` : 'Unknown'}</td>
                          <td style={{ padding: '0.5rem', fontSize: '0.875rem' }}>{sub ? sub.name : 'Unknown'}</td>
                          <td style={{ padding: '0.5rem' }}>
                            <button className="text-red-500 hover:text-red-700 text-sm font-semibold" onClick={() => handleRemoveAssignment(a.id)}>Remove</button>
                          </td>
                        </tr>
                      );
                    })}
                    {teacherAssignments.length === 0 && <tr><td colSpan="3" style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No assignments yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold mb-2">Assign New Class & Subject</h4>
              <div className="flex gap-2">
                <select className="input-field flex-1" style={{ background: 'white', border: '1px solid #e2e8f0' }} value={modalAssignmentClass} onChange={e => setModalAssignmentClass(e.target.value)}>
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                </select>
                <select className="input-field flex-1" style={{ background: 'white', border: '1px solid #e2e8f0' }} value={modalAssignmentSubject} onChange={e => setModalAssignmentSubject(e.target.value)}>
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button className="btn btn-primary" style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem' }} onClick={handleModalAssignTeacher}>Assign</button>
              </div>
            </div>

            <div className="flex justify-end">
              <button className="btn btn-outline" style={{ border: '1px solid #e2e8f0', padding: '0.5rem 1.5rem', borderRadius: '0.375rem' }} onClick={() => setEditingTeacher(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Website CMS */}
      {activeTab === 'cms' && <WebsiteCMS />}

      <input 
        type="file" 
        accept="image/jpeg, image/png, image/webp" 
        ref={studentPhotoInputRef} 
        style={{ display: 'none' }} 
        onChange={handleStudentPhotoUpload} 
      />

    </motion.div>
  );
};

export default Admin;
