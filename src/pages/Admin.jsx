import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useData } from '../context/DataContext';
import { getConversionConstants } from './SubjectMarks';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import * as XLSX from 'xlsx';

const Admin = () => {
  const { academicYear, classes, subjects, students, updateStudentLanguages, loadingData } = useData();
  const [stats, setStats] = useState({ classes: 0, students: 0, subjects: 0, teachers: 0 });
  
  const [teachers, setTeachers] = useState([]);
  
  // State for Language Edit Modal
  const [editingLangStudent, setEditingLangStudent] = useState(null);
  const [editSecondLang, setEditSecondLang] = useState('');
  const [editThirdLang, setEditThirdLang] = useState('');
  const [editElectiveSubject, setEditElectiveSubject] = useState('');
  const [editSixthSubject, setEditSixthSubject] = useState('');

  const [newClass, setNewClass] = useState({ name: '', section: '' });
  const [newSubject, setNewSubject] = useState('');
  const [assignment, setAssignment] = useState({ teacher_id: '', class_id: '', subject_id: '' });
  
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
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const formattedStudents = data.map(row => {
          const name = row['Name'] || row['name'] || row['Student Name'] || row["Student's Name"];
          const rollNo = row['Roll No'] || row['Roll Number'] || row['roll no'] || row['Roll'] || row['No.'];
          const secLang = row['2nd Language'] || row['Second Language'] || row['2nd Lang'] || null;
          const thirdLang = row['3rd Language'] || row['Third Language'] || row['3rd Lang'] || null;
          
          return {
            class_id: importClassId,
            name: name,
            roll_no: parseInt(rollNo),
            second_language: secLang,
            third_language: thirdLang
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
    reader.readAsBinaryString(file);
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
    <div>
      <div className="page-header mb-4">
        <div>
          <h1>Admin Dashboard</h1>
          <p>System Management and Analytics</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <h3>Total Classes</h3>
          <p style={{ fontSize: '2rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>{stats.classes}</p>
        </div>
        <div className="card text-center">
          <h3>Total Students</h3>
          <p style={{ fontSize: '2rem', color: 'var(--secondary-color)', fontWeight: 'bold' }}>{stats.students}</p>
        </div>
        <div className="card text-center">
          <h3>Subjects</h3>
          <p style={{ fontSize: '2rem', color: 'var(--warning-color)', fontWeight: 'bold' }}>{stats.subjects}</p>
        </div>
        <div className="card text-center">
          <h3>Teachers</h3>
          <p style={{ fontSize: '2rem', color: 'var(--danger-color)', fontWeight: 'bold' }}>{stats.teachers}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        
        <div className="flex" style={{ flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h3 className="mb-4">Class Performance Analytics</h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Legend />
                  <Bar dataKey="averageScore" name="Average Score" fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="highestScore" name="Highest Score" fill="var(--secondary-color)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-4 text-primary">Bulk Import Students</h3>
            <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
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
                  style={{ padding: '0.5rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', width: '100%' }}
                />
                <button className="btn btn-primary" onClick={handleFileUpload}>
                  Import
                </button>
              </div>

              <button 
                className="btn btn-outline mt-4" 
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

          <div className="card">
            <h3 className="mb-4 text-secondary">Bulk Import Historical Totals</h3>
            <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
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
                <label className="text-sm font-bold block mb-2">3. Upload Historical Excel</label>
                <div className="flex gap-2">
                  <input 
                    type="file" 
                    accept=".xlsx, .xls, .csv"
                    ref={flowsheetFileRef}
                    style={{ padding: '0.5rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', width: '100%' }}
                  />
                  <button className="btn btn-primary" onClick={handleUploadFlowsheet}>
                    Import
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card flex" style={{ flexDirection: 'column', gap: '2rem' }}>
          
          <div>
            <h3 className="mb-4">Manage Students</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Roll</th>
                    <th>Name</th>
                    <th>Class</th>
                    <th>2nd Lang</th>
                    <th>3rd Lang</th>
                    <th>Elective</th>
                    <th>6th Subject</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.sort((a,b) => {
                    if (a.class_id !== b.class_id) return a.class_id.localeCompare(b.class_id);
                    return a.roll_no - b.roll_no;
                  }).map(s => {
                    const sCls = classes.find(c => c.id === s.class_id);
                    return (
                      <tr key={s.id}>
                        <td>{s.roll_no}</td>
                        <td>{s.name}</td>
                        <td>{sCls ? `${sCls.name} ${sCls.section}` : 'Unknown'}</td>
                        <td>{s.second_language || '-'}</td>
                        <td>{s.third_language || '-'}</td>
                        <td>{s.elective_subject || '-'}</td>
                        <td>{s.sixth_subject || '-'}</td>
                        <td>
                          <button 
                            className="btn btn-outline btn-sm"
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

          <div>
            <h3 className="mb-4">Manage Classes</h3>
            <form onSubmit={handleAddClass} className="flex gap-2 mb-4">
              <input 
                type="text" 
                placeholder="Class Name" 
                className="input-field" 
                value={newClass.name}
                onChange={e => setNewClass({...newClass, name: e.target.value})}
                required
              />
              <input 
                type="text" 
                placeholder="Section" 
                className="input-field" 
                style={{ width: '100px' }}
                value={newClass.section}
                onChange={e => setNewClass({...newClass, section: e.target.value})}
                required
              />
              <button type="submit" className="btn btn-primary">Add</button>
            </form>
            
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map(c => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.section}</td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => window.location.href = `/classes/${c.id}/flowsheet`}
                          className="btn btn-outline btn-sm" 
                          style={{ color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
                        >
                          Flowsheet
                        </button>
                        <button 
                          onClick={() => window.location.href = `/classes/${c.id}/reports`}
                          className="btn btn-outline btn-sm" 
                          style={{ color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
                        >
                          Reports
                        </button>
                        <button 
                          onClick={() => handleDeleteClass(c.id)} 
                          className="btn btn-outline btn-sm" 
                          style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {classes.length === 0 && <tr><td colSpan="3">No classes found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-4">Manage Subjects</h3>
            <form onSubmit={handleAddSubject} className="flex gap-2 mb-4">
              <input 
                type="text" 
                placeholder="Subject Name" 
                className="input-field" 
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary">Add</button>
            </form>

            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject Name</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map(s => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>
                        <button 
                          onClick={() => handleDeleteSubject(s.id)} 
                          className="btn btn-outline btn-sm" 
                          style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {subjects.length === 0 && <tr><td colSpan="2">No subjects found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-4">Assign Teacher to Class</h3>
            <form onSubmit={handleAssignTeacher} className="flex flex-col gap-2">
              <select 
                className="input-field" 
                value={assignment.teacher_id} 
                onChange={e => setAssignment({...assignment, teacher_id: e.target.value})}
                required
              >
                <option value="">Select Teacher</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              
              <select 
                className="input-field" 
                value={assignment.class_id} 
                onChange={e => setAssignment({...assignment, class_id: e.target.value})}
                required
              >
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </select>

              <select 
                className="input-field" 
                value={assignment.subject_id} 
                onChange={e => setAssignment({...assignment, subject_id: e.target.value})}
                required
              >
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              <button type="submit" className="btn btn-secondary mt-2">Assign Teacher</button>
            </form>
          </div>

        </div>
      </div>

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
    </div>
  );
};

export default Admin;
