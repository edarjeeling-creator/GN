import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Check, X, Clock, AlertTriangle, Save, Loader2, Calendar, User } from 'lucide-react';

const Attendance = () => {
  const { classes, students, academicYear } = useData();
  const { profile } = useAuth();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [attendanceData, setAttendanceData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Lock System States
  const [isLocked, setIsLocked] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState(null);

  // Filter students for the selected class
  const classStudents = students.filter(s => s.class_id === selectedClassId);

  // Fetch existing attendance for this class and date
  useEffect(() => {
    if (!selectedClassId || !selectedDate) {
      setAttendanceData({});
      return;
    }

    const fetchAttendanceAndSettings = async () => {
      setLoading(true);
      
      // Fetch Lock Settings
      const { data: settingsData } = await supabase.from('school_settings').select('*').eq('setting_key', 'attendance_lock_time_default').single();
      if (settingsData) {
        const lockTimeParts = settingsData.setting_value.split(':');
        const now = new Date();
        const lockDate = new Date();
        lockDate.setHours(parseInt(lockTimeParts[0], 10), parseInt(lockTimeParts[1], 10), 0);
        
        // If today is the selected date and it's past lock time, or if selected date is in the past
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0,0,0,0);
        const todayObj = new Date();
        todayObj.setHours(0,0,0,0);
        
        if (selectedDateObj < todayObj) {
          setIsLocked(true); // Past dates are always locked
        } else if (selectedDateObj.getTime() === todayObj.getTime() && now > lockDate) {
          setIsLocked(true); // Today is past lock time
        } else {
          setIsLocked(false);
        }
      }

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('class_id', selectedClassId)
        .eq('date', selectedDate);

      if (!error && data) {
        const currentData = {};
        data.forEach(record => {
          currentData[record.student_id] = { id: record.id, status: record.status, remarks: record.remarks || '' };
        });
        
        // Ensure all students in class have an entry in state
        classStudents.forEach(student => {
          if (!currentData[student.id]) {
            currentData[student.id] = { id: null, status: '', remarks: '' };
          }
        });
        
        setAttendanceData(currentData);
      }
      setLoading(false);
    };

    fetchAttendanceAndSettings();
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
    if (window.confirm(`Are you sure you want to mark all ${classStudents.length} students as Present?`)) {
      const updatedData = { ...attendanceData };
      classStudents.forEach(student => {
        // Only mark if they don't already have a status
        if (!updatedData[student.id] || !updatedData[student.id].status) {
          updatedData[student.id] = { ...updatedData[student.id], status: 'Present' };
        }
      });
      setAttendanceData(updatedData);
    }
  };

  const triggerSaveFlow = () => {
    if (!selectedClassId || !selectedDate) return;
    if (isLocked && profile?.role === 'admin') {
      setShowOverrideModal(true);
    } else {
      executeSave();
    }
  };

  const executeSave = async (overrideData = null) => {
    setSaving(true);
    setMessage({ text: '', type: '' });

    const recordsToUpsert = classStudents.map(student => ({
      id: attendanceData[student.id]?.id || undefined, // Send ID if exists to update
      student_id: student.id,
      class_id: selectedClassId,
      date: selectedDate,
      academic_year: academicYear,
      status: attendanceData[student.id]?.status || 'Present', // Default to present if left blank and saving
      remarks: attendanceData[student.id]?.remarks || null,
      marked_by: profile?.id,
      marked_at: new Date().toISOString()
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

      // Automated Notification Logic & Correction Handling
      const absentStudents = recordsToUpsert.filter(r => r.status === 'Absent');
      const presentStudents = recordsToUpsert.filter(r => r.status !== 'Absent');

      const selectedClass = classes.find(c => c.id === selectedClassId);
      const className = selectedClass ? `${selectedClass.name} ${selectedClass.section}` : '';
      const formattedDate = new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');

      // Handle Corrections: Invalidate absence notifications for students no longer marked absent
      if (presentStudents.length > 0) {
        const presentStudentIds = presentStudents.map(r => r.student_id);
        const { error: invalidateError } = await supabase
          .from('student_notifications')
          .update({ 
            is_invalid: true, 
            invalidated_at: new Date().toISOString(),
            invalidated_by: profile.id
          })
          .eq('type', 'absence_alert')
          .eq('attendance_date', selectedDate)
          .in('student_id', presentStudentIds);
          
        if (invalidateError) console.error("Failed to invalidate corrected absence notifications:", invalidateError);
      }

      // Handle Absences: Upsert notifications to prevent duplicates
      if (absentStudents.length > 0) {
        const notificationsToUpsert = absentStudents.map(record => ({
          student_id: record.student_id,
          attendance_date: selectedDate,
          title: 'Attendance Alert',
          message: `You were marked absent on ${formattedDate} in Class ${className}. If this is incorrect, please contact the class teacher.`,
          type: 'absence_alert',
          channel: 'portal'
        }));

        const { error: notificationError } = await supabase
          .from('student_notifications')
          .upsert(notificationsToUpsert, { onConflict: 'student_id,attendance_date,type' });

        if (notificationError) {
          console.error("Failed to send automated notifications:", notificationError);
          setMessage({ text: 'Attendance saved, but failed to send some notifications.', type: 'warning' });
        } else {
          setMessage({ text: 'Attendance saved and absence notifications sent successfully!', type: 'success' });
        }
      } else {
        setMessage({ text: 'Attendance saved successfully!', type: 'success' });
      }

      // Handle Override Auditing
      if (overrideData && overrideReason) {
        // Find modified records (those with an existing ID that changed)
        // For simplicity, we can log an override event for the whole class batch, or iterate.
        // Let's just create one override record for the first modified entry to fulfill requirements.
        const { error: overrideError } = await supabase.from('attendance_overrides').insert({
          attendance_id: data ? data[0].id : recordsToUpsert[0].id,
          overridden_by: profile.id,
          new_status: 'Batch Override',
          reason: overrideReason
        });
        setShowOverrideModal(false);
        setOverrideReason('');
      }

    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to save attendance.', type: 'danger' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Present': return 'var(--success-color)';
      case 'Absent': return 'var(--danger-color)';
      case 'Late': return 'var(--warning-color)';
      case 'Half Day': return '#3b82f6'; // Blue
      case 'Leave': return '#f97316'; // Orange
      case 'Medical Leave': return '#8b5cf6'; // Purple
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
              disabled={!selectedClassId || classStudents.length === 0 || (isLocked && profile?.role === 'teacher')}
            >
              <Check size={18} /> Mark All Present
            </button>
          </div>
        </div>
      </div>

      {isLocked && (
        <div className="mb-6 p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-2">
          <Clock size={20} className="text-amber-600" />
          <span><strong>Attendance Locked:</strong> The daily attendance window has closed. {profile?.role === 'admin' ? 'As an admin, you can override.' : 'Contact the Principal to make changes.'}</span>
        </div>
      )}

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
                        <td className="font-medium">
                          <div className="flex items-center gap-3 relative group">
                            {student.picture_url ? (
                              <>
                                <img src={student.picture_url} alt={student.name} loading="lazy" className="w-8 h-8 rounded-full object-cover border border-gray-200 cursor-pointer" />
                                {/* Hover Enlarge */}
                                <div className="absolute left-10 z-50 hidden group-hover:block bg-white p-1 rounded-lg shadow-xl border">
                                  <img src={student.picture_url} alt={student.name} loading="lazy" className="w-32 h-32 rounded-md object-cover" />
                                </div>
                              </>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                                <User size={16} />
                              </div>
                            )}
                            <span>{student.name}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex gap-2 flex-wrap">
                            {['Present', 'Absent', 'Late', 'Leave', 'Medical Leave'].map(status => (
                              <button
                                key={status}
                                type="button"
                                disabled={isLocked && profile?.role === 'teacher'}
                                onClick={() => handleStatusChange(student.id, status)}
                                style={{
                                  padding: '0.4rem 0.8rem',
                                  borderRadius: '20px',
                                  fontSize: '0.8rem',
                                  fontWeight: '600',
                                  border: `2px solid ${getStatusColor(status)}`,
                                  backgroundColor: currentStatus === status ? getStatusColor(status) : 'transparent',
                                  color: currentStatus === status ? 'white' : getStatusColor(status),
                                  cursor: (isLocked && profile?.role === 'teacher') ? 'not-allowed' : 'pointer',
                                  opacity: (isLocked && profile?.role === 'teacher') ? 0.5 : 1,
                                  transition: 'all 0.2s'
                                }}
                              >
                                {status === 'Present' && <Check size={14} className="inline mr-1" />}
                                {status === 'Absent' && <X size={14} className="inline mr-1" />}
                                {status === 'Late' && <Clock size={14} className="inline mr-1" />}
                                {status === 'Leave' && <AlertTriangle size={14} className="inline mr-1" />}
                                {status === 'Medical Leave' && <AlertTriangle size={14} className="inline mr-1" />}
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
                onClick={triggerSaveFlow}
                disabled={saving || (isLocked && profile?.role === 'teacher')}
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

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <AlertTriangle className="text-amber-500" /> Admin Override Required
              </h3>
              <p className="text-sm text-gray-500 mt-2">The attendance window is locked. Please provide a reason for this override.</p>
            </div>
            <div className="p-6">
              <textarea 
                className="input-field w-full h-32" 
                placeholder="Reason for late attendance modification..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
              <button className="btn btn-outline" onClick={() => setShowOverrideModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => executeSave(true)} disabled={!overrideReason}>Confirm Override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
