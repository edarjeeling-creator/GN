import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Book, CheckCircle, Circle, Users, FileText, UserPlus, Phone, Edit2, Check, X } from 'lucide-react';
import { formatStudentDisplayName } from '../utils/studentUtils';

const Classes = () => {
  const { classes, subjects, students, teacherSubjects, toggleTeacherSubject, addStudent, addSubject, updateStudentContactNumber } = useData();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isPrincipal = profile?.role === 'principal';
  const isPrivileged = isAdmin || isPrincipal;
  const [showAllClasses, setShowAllClasses] = useState(false);
  
  const [expandedClass, setExpandedClass] = useState(null);
  
  // State for new student form
  const [newStudent, setNewStudent] = useState({ name: '', roll_no: '', contact_number: '' });
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [savingStudentId, setSavingStudentId] = useState(null);
  
  // State for new subject form
  const [newSubject, setNewSubject] = useState('');

  const toggleExpand = (classId) => {
    if (expandedClass === classId) {
      setExpandedClass(null);
    } else {
      setExpandedClass(classId);
    }
  };

  const handleStartEditPhone = (student) => {
    setEditingStudentId(student.id);
    setPhoneInput(student.contact_number || '');
  };

  const handleCancelEdit = () => {
    setEditingStudentId(null);
    setPhoneInput('');
  };

  const handleSavePhone = async (studentId) => {
    setSavingStudentId(studentId);
    try {
      const res = await updateStudentContactNumber(studentId, phoneInput);
      if (res?.success) {
        setEditingStudentId(null);
      } else {
        alert("Failed to update contact number: " + (res?.error?.message || "Please try again."));
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSavingStudentId(null);
    }
  };

  const handleAddStudent = async (e, classId) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.roll_no) return;
    
    const res = await addStudent(classId, newStudent.name, parseInt(newStudent.roll_no), newStudent.contact_number || null);
    if (res.success) {
      setNewStudent({ name: '', roll_no: '', contact_number: '' });
      alert("Student added successfully!");
    } else {
      alert("Error adding student: " + res.error.message);
    }
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!newSubject) return;
    
    const res = await addSubject(newSubject);
    if (res.success) {
      setNewSubject('');
      alert("Subject added successfully!");
    } else {
      alert("Error adding subject: " + res?.error?.message || "Unknown error");
    }
  };

  const displayedClasses = classes.filter(cls => 
    isPrivileged || showAllClasses || (teacherSubjects[cls.id] || []).length > 0
  );

  return (
    <div>
      <div className="page-header mb-4 flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1>My Classes</h1>
          <p>Select a class to manage subjects, add students, and view flowsheets.</p>
        </div>
        {!isPrivileged && (
          <button 
            type="button" 
            onClick={() => setShowAllClasses(prev => !prev)}
            className="btn btn-outline btn-sm"
          >
            {showAllClasses ? 'Show Only My Classes' : 'Browse All Classes'}
          </button>
        )}
      </div>
      
      {displayedClasses.length === 0 ? (
        <div className="card text-center p-8">
          <Users size={48} className="mx-auto text-muted mb-3" style={{ opacity: 0.5 }} />
          <h3 className="text-lg font-bold mb-2">No Classes Assigned Yet</h3>
          <p className="text-muted mb-4">You have not selected any classes or subjects to teach yet.</p>
          <button 
            type="button" 
            onClick={() => setShowAllClasses(true)}
            className="btn btn-primary btn-sm mx-auto"
          >
            Browse All Classes to Select Subjects
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {displayedClasses.map(cls => {
            const selectedSubjects = teacherSubjects[cls.id] || [];
            const isExpanded = expandedClass === cls.id;

          return (
            <div key={cls.id} className="card">
              <div className="card-header" style={{ marginBottom: isExpanded ? '1rem' : '0', cursor: 'pointer' }} onClick={() => toggleExpand(cls.id)}>
                <div>
                  <h3 className="flex items-center gap-2">
                    <Users size={24} className="text-primary"/>
                    {cls.name} {cls.section}
                  </h3>
                  <p className="mt-2 text-sm">{selectedSubjects.length} subjects selected</p>
                </div>
                <button className="btn btn-outline btn-sm">
                  {isExpanded ? 'Collapse' : 'Manage'}
                </button>
              </div>

              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  
                  {/* Subject Selection */}
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="flex items-center gap-2">
                      <Book size={20} /> My Subjects
                    </h4>
                    <div className="flex gap-2">
                      <Link to={`/classes/${cls.id}/flowsheet`} className="btn btn-secondary btn-sm">
                        <FileText size={16} /> View Flowsheet
                      </Link>
                      <Link to={`/classes/${cls.id}/reports`} className="btn btn-outline btn-sm">
                        <FileText size={16} /> Report Cards
                      </Link>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {subjects.map(subject => {
                      const isSelected = selectedSubjects.includes(subject.id);
                      return (
                        <div 
                          key={subject.id}
                          onClick={(e) => { e.stopPropagation(); toggleTeacherSubject(cls.id, subject.id); }}
                          style={{
                            padding: '1rem',
                            border: `1px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.05)' : 'var(--surface-color)',
                            transition: 'all 0.2s'
                          }}
                        >
                          <span style={{ fontWeight: isSelected ? '600' : '400', color: isSelected ? 'var(--primary-color)' : 'var(--text-primary)' }}>
                            {subject.name}
                          </span>
                          {isSelected ? (
                            <CheckCircle size={20} className="text-primary" />
                          ) : (
                            <Circle size={20} style={{ color: 'var(--border-color)' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mb-6">
                    <form onSubmit={handleAddSubject} className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Create a new subject" 
                        className="input-field" 
                        value={newSubject}
                        onChange={e => setNewSubject(e.target.value)}
                        required
                        style={{ maxWidth: '300px' }}
                      />
                      <button type="submit" className="btn btn-outline btn-sm">Create Subject</button>
                    </form>
                  </div>

                  {selectedSubjects.length > 0 && (
                    <div className="mb-6">
                      <h4 className="mb-2">Enter Marks</h4>
                      <div className="flex gap-2 flex-wrap">
                        {selectedSubjects.map(subId => {
                          const sub = subjects.find(s => s.id === subId);
                          if (!sub) return null;
                          return (
                            <Link key={subId} to={`/classes/${cls.id}/subjects/${subId}`} className="btn btn-primary btn-sm">
                              {sub.name}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add Student Section */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <h4 className="flex items-center gap-2 mb-4">
                      <UserPlus size={20} /> Class Roster ({students.filter(s => s.class_id === cls.id).length} Students)
                    </h4>
                    
                    {/* List of existing students */}
                    <div className="mb-4" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.9rem' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '80px' }}>Roll No</th>
                            <th>Student Name</th>
                            <th>Parent Phone</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.filter(s => s.class_id === cls.id).sort((a, b) => a.roll_no - b.roll_no).map(student => {
                            const isEditing = editingStudentId === student.id;
                            const isSaving = savingStudentId === student.id;
                            return (
                              <tr key={student.id}>
                                <td>{student.roll_no}</td>
                                <td style={{ fontWeight: 500 }}>{formatStudentDisplayName(student.name)}</td>
                                <td>
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="tel"
                                        placeholder="10-digit number"
                                        value={phoneInput}
                                        onChange={(e) => setPhoneInput(e.target.value)}
                                        className="input-field"
                                        style={{ width: '130px', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSavePhone(student.id)}
                                        disabled={isSaving}
                                        className="btn btn-primary btn-sm"
                                        style={{ padding: '0.2rem 0.4rem' }}
                                      >
                                        {isSaving ? '...' : <Check size={12} />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="btn btn-outline btn-sm"
                                        style={{ padding: '0.2rem 0.4rem' }}
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      {student.contact_number ? (
                                        <span className="flex items-center gap-1 text-slate-700">
                                          <Phone size={12} className="text-emerald-600" />
                                          {student.contact_number}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 italic text-xs">No phone</span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditPhone(student)}
                                        className="text-xs text-blue-600 hover:text-blue-800 underline flex items-center gap-0.5"
                                        title="Edit phone number"
                                      >
                                        <Edit2 size={10} /> {student.contact_number ? 'Edit' : '+ Add'}
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {students.filter(s => s.class_id === cls.id).length === 0 && (
                            <tr><td colSpan="3">No students added yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <form onSubmit={(e) => handleAddStudent(e, cls.id)} className="flex gap-2 flex-wrap">
                      <input 
                        type="text" 
                        placeholder="Student Full Name" 
                        className="input-field" 
                        style={{ maxWidth: '220px' }}
                        value={newStudent.name}
                        onChange={e => setNewStudent({...newStudent, name: e.target.value})}
                        required
                      />
                      <input 
                        type="number" 
                        placeholder="Roll No" 
                        className="input-field" 
                        style={{ width: '90px' }}
                        value={newStudent.roll_no}
                        onChange={e => setNewStudent({...newStudent, roll_no: e.target.value})}
                        required
                        min="1"
                      />
                      <input 
                        type="tel" 
                        placeholder="Parent Phone (Optional)" 
                        className="input-field" 
                        style={{ maxWidth: '180px' }}
                        value={newStudent.contact_number}
                        onChange={e => setNewStudent({...newStudent, contact_number: e.target.value})}
                      />
                      <button type="submit" className="btn btn-outline btn-sm">Add Student</button>
                    </form>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

export default Classes;
