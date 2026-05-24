import { useState } from 'react';
import { useData } from '../context/DataContext';
import { Search, User } from 'lucide-react';

const StudentSearch = () => {
  const { students, classes } = useData();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter students based on search term
  const filteredStudents = searchTerm.trim() === '' ? [] : students.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrintCard = (uid) => {
    // Open the result portal in a new tab with the UID pre-filled
    window.open(`/result?uid=${uid}`, '_blank');
  };

  return (
    <div>
      <div className="page-header mb-6">
        <div>
          <h1>Global Student Search</h1>
          <p>Instantly find any student in the school and print their report card.</p>
        </div>
      </div>

      <div className="card max-w-3xl mx-auto">
        <div className="relative mb-6">
          <Search size={24} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by student name..."
            className="input-field w-full"
            style={{ paddingLeft: '50px', fontSize: '1.2rem', padding: '1rem 1rem 1rem 50px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        {searchTerm.trim() !== '' && (
          <div>
            <h3 className="mb-4">Search Results ({filteredStudents.length})</h3>
            
            {filteredStudents.length === 0 ? (
              <div className="text-center p-8 text-muted">
                No students found matching "{searchTerm}"
              </div>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Class</th>
                      <th>Roll No</th>
                      <th>UID (PIN)</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(student => {
                      const cls = classes.find(c => c.id === student.class_id);
                      return (
                        <tr key={student.id}>
                          <td style={{ fontWeight: '500' }}>
                            <div className="flex items-center gap-2">
                              <User size={16} className="text-primary" />
                              {student.name}
                            </div>
                          </td>
                          <td>{cls ? `${cls.name} ${cls.section}` : 'Unknown'}</td>
                          <td>{student.roll_no}</td>
                          <td style={{ letterSpacing: '1px' }}>{student.uid}</td>
                          <td>
                            <button 
                              className="btn btn-primary btn-sm"
                              onClick={() => handlePrintCard(student.uid)}
                            >
                              View Report Card
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentSearch;
