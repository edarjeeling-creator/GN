import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useData } from '../context/DataContext';
import { Check, X, Clock, AlertTriangle, Save, Loader2, Calendar } from 'lucide-react';

const Attendance = () => {
  const { classes, students, academicYear } = useData();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [attendanceData, setAttendanceData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Filter students for the selected class
  const classStudents = students.filter(s => s.class_id === selectedClassId);

  // Fetch existing attendance for this class and date
  useEffect(() => {
    if (!selectedClassId || !selectedDate) {
      setAttendanceData({});
      return;
    }

    const fetchAttendance = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('class_id', selectedClassId)
        .eq('date', selectedDate);

      if (!error && data) {
        const currentData = {};
        data.forEach(record => {
          currentData[record.student_id] = { status: record.status, remarks: record.remarks || '' };
        });
        
        // Ensure all students in class have an entry in state
        classStudents.forEach(student => {
          if (!currentData[student.id]) {
            currentData[student.id] = { status: '', remarks: '' };
          }
        });
        
        setAttendanceData(currentData);
      }
      setLoading(false);
    };

    fetchAttendance();
  }, [selectedClassId, selectedDate, students]);

  const handleStatusChange = (studentId, status) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], status }
    }));
  };

  const handleRemarksChange = (studentId, remarks) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], remarks }
    }));
  };

  const markAllPresent = () => {
    const updatedData = { ...attendanceData };
    classStudents.forEach(student => {
      updatedData[student.id] = { ...updatedData[student.id], status: 'Present' };
    });
    setAttendanceData(updatedData);
  };

  const saveAttendance = async () => {
    if (!selectedClassId || !selectedDate) return;
    
    setSaving(true);
    setMessage({ text: '', type: '' });

    const recordsToUpsert = classStudents.map(student => ({
      student_id: student.id,
      class_id: selectedClassId,
      date: selectedDate,
      academic_year: academicYear,
      status: attendanceData[student.id]?.status || 'Present', // Default to present if left blank and saving
      remarks: attendanceData[student.id]?.remarks || null
    })).filter(record => record.status !== ''); // Only save those that have a status

    if (recordsToUpsert.length === 0) {
      setMessage({ text: 'Please mark attendance before saving.', type: 'danger' });
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('attendance')
        .upsert(recordsToUpsert, { onConflict: 'student_id,date' });

      if (error) throw error;
      
      setMessage({ text: 'Attendance saved successfully!', type: 'success' });
      // Data will refresh on reload or if we add a refresh function later
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to save attendance.', type: 'danger' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Present': return 'var(--success-color)';
      case 'Absent': return 'var(--danger-color)';
      case 'Late': return 'var(--warning-color)';
      case 'Half Day': return '#3b82f6'; // Blue
      case 'Leave': return '#f97316'; // Orange
      default: return 'var(--border-color)';
    }
  };

  return (
    <div>
      <div className="page-header mb-6">
        <div>
          <h1>Daily Attendance</h1>
          <p>Mark and manage daily attendance for your classes.</p>
        </div>
      </div>

      <div className="card mb-6 p-4">
        <div className="grid md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block mb-2 font-bold">Select Class</label>
            <select 
              className="input-field w-full"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              <option value="">-- Choose Class --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.section}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-2 font-bold">Date</label>
            <div className="relative">
              <Calendar size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" style={{ left: '10px' }} />
              <input 
                type="date" 
                className="input-field w-full"
                style={{ paddingLeft: '35px' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <button 
              className="btn btn-outline w-full" 
              onClick={markAllPresent}
              disabled={!selectedClassId || classStudents.length === 0}
            >
              <Check size={18} /> Mark All Present
            </button>
          </div>
        </div>
      </div>

      {message.text && (
        <div className={`mb-6 p-4 rounded-md text-white`} style={{ backgroundColor: message.type === 'success' ? 'var(--success-color)' : 'var(--danger-color)' }}>
          {message.text}
        </div>
      )}

      {selectedClassId ? (
        loading ? (
          <div className="flex justify-center items-center p-12">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : classStudents.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            No students found in this class.
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Roll No</th>
                    <th>Student Name</th>
                    <th>Attendance Status</th>
                    <th>Remarks (Optional)</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.sort((a,b) => a.roll_no - b.roll_no).map(student => {
                    const currentStatus = attendanceData[student.id]?.status || '';
                    return (
                      <tr key={student.id}>
                        <td className="text-center font-bold">{student.roll_no}</td>
                        <td className="font-medium">{student.name}</td>
                        <td>
                          <div className="flex gap-2">
                            {['Present', 'Absent', 'Late', 'Half Day', 'Leave'].map(status => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => handleStatusChange(student.id, status)}
                                style={{
                                  padding: '0.4rem 0.8rem',
                                  borderRadius: '20px',
                                  fontSize: '0.8rem',
                                  fontWeight: '600',
                                  border: `2px solid ${getStatusColor(status)}`,
                                  backgroundColor: currentStatus === status ? getStatusColor(status) : 'transparent',
                                  color: currentStatus === status ? 'white' : getStatusColor(status),
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                              >
                                {status === 'Present' && <Check size={14} className="inline mr-1" />}
                                {status === 'Absent' && <X size={14} className="inline mr-1" />}
                                {status === 'Late' && <Clock size={14} className="inline mr-1" />}
                                {status === 'Half Day' && <Clock size={14} className="inline mr-1" />}
                                {status === 'Leave' && <AlertTriangle size={14} className="inline mr-1" />}
                                {status}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="input-field py-1 text-sm"
                            placeholder="Reason for leave/late..."
                            value={attendanceData[student.id]?.remarks || ''}
                            onChange={(e) => handleRemarksChange(student.id, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t flex justify-end" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
              <button 
                className="btn btn-primary" 
                onClick={saveAttendance}
                disabled={saving}
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {saving ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="card p-12 text-center text-gray-500">
          <Calendar size={48} className="mx-auto mb-4 opacity-50" />
          <h3>Select a class and date to mark attendance</h3>
        </div>
      )}
    </div>
  );
};

export default Attendance;
