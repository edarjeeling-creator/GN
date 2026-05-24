import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Book, CheckCircle, Circle, Users, FileText, UserPlus } from 'lucide-react';

const Classes = () => {
  const { classes, subjects, students, teacherSubjects, toggleTeacherSubject, addStudent } = useData();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  
  const [expandedClass, setExpandedClass] = useState(null);
  
  // State for new student form
  const [newStudent, setNewStudent] = useState({ name: '', roll_no: '' });

  const toggleExpand = (classId) => {
    if (expandedClass === classId) {
      setExpandedClass(null);
    } else {
      setExpandedClass(classId);
    }
  };

  const handleAddStudent = async (e, classId) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.roll_no) return;
    
    const res = await addStudent(classId, newStudent.name, parseInt(newStudent.roll_no));
    if (res.success) {
      setNewStudent({ name: '', roll_no: '' });
      alert("Student added successfully!");
    } else {
      alert("Error adding student: " + res.error.message);
    }
  };

  return (
    <div>
      <div className="page-header mb-4">
        <div>
          <h1>My Classes</h1>
          <p>Select a class to manage subjects, add students, and view flowsheets.</p>
        </div>
      </div>
      
      <div className="grid gap-4">
        {classes.filter(cls => isAdmin || (teacherSubjects[cls.id] || []).length > 0).map(cls => {
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

                  {isAdmin && (
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
                  )}

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
                    <div className="mb-4" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.9rem' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '80px' }}>Roll No</th>
                            <th>Student Name</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.filter(s => s.class_id === cls.id).sort((a, b) => a.roll_no - b.roll_no).map(student => (
                            <tr key={student.id}>
                              <td>{student.roll_no}</td>
                              <td>{student.name}</td>
                            </tr>
                          ))}
                          {students.filter(s => s.class_id === cls.id).length === 0 && (
                            <tr><td colSpan="2">No students added yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <form onSubmit={(e) => handleAddStudent(e, cls.id)} className="flex gap-2 flex-wrap">
                      <input 
                        type="text" 
                        placeholder="Student Full Name" 
                        className="input-field" 
                        style={{ maxWidth: '250px' }}
                        value={newStudent.name}
                        onChange={e => setNewStudent({...newStudent, name: e.target.value})}
                        required
                      />
                      <input 
                        type="number" 
                        placeholder="Roll No" 
                        className="input-field" 
                        style={{ width: '100px' }}
                        value={newStudent.roll_no}
                        onChange={e => setNewStudent({...newStudent, roll_no: e.target.value})}
                        required
                        min="1"
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
    </div>
  );
};

export default Classes;
