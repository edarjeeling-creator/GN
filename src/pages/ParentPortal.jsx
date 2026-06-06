import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Calendar, AlertCircle, Phone, Mail, Clock, CheckCircle, AlertTriangle, User } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ParentPortal = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [linkedStudents, setLinkedStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [classInfo, setClassInfo] = useState(null);

  useEffect(() => {
    fetchParentData();
  }, [profile]);

  const fetchParentData = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      // 1. Get Parent Record
      const { data: parentData } = await supabase
        .from('parents')
        .select('id')
        .eq('user_id', profile.id)
        .single();

      if (!parentData) {
        setLoading(false);
        return;
      }

      // 2. Get Linked Students
      const { data: mapData } = await supabase
        .from('parent_student_map')
        .select('student_id')
        .eq('parent_id', parentData.id);

      if (mapData && mapData.length > 0) {
        const studentIds = mapData.map(m => m.student_id);
        const { data: studentsData } = await supabase
          .from('students')
          .select('*, classes(name, section)')
          .in('id', studentIds);

        setLinkedStudents(studentsData || []);
        if (studentsData && studentsData.length > 0) {
          handleSelectStudent(studentsData[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStudent = async (student) => {
    setSelectedStudent(student);
    
    // Fetch Attendance
    const { data: attData } = await supabase
      .from('attendance')
      .select('*')
      .eq('student_id', student.id)
      .order('date', { ascending: false });
      
    setAttendance(attData || []);

    // Fetch Alerts
    const { data: alertData } = await supabase
      .from('system_alerts')
      .select('*')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });
      
    setAlerts(alertData || []);
    
    // Fetch Class Details (for Teacher Contact)
    const { data: classData } = await supabase
      .from('classes')
      .select('*')
      .eq('id', student.class_id)
      .single();
      
    setClassInfo(classData);
  };

  if (loading) return <div className="p-12 text-center text-slate-500">Loading Dashboard...</div>;

  if (linkedStudents.length === 0) {
    return (
      <div className="card p-12 text-center text-slate-500">
        <AlertCircle size={48} className="mx-auto mb-4 opacity-50 text-amber-500" />
        <h3 className="text-xl font-bold mb-2">No Students Linked</h3>
        <p>Your account is not currently linked to any students. Please contact the school administration.</p>
        <div className="mt-8 text-sm bg-slate-50 p-4 rounded-lg inline-block border text-left">
          <strong>School Contact:</strong><br />
          <Phone size={14} className="inline mr-2" /> (555) 123-4567<br />
          <Mail size={14} className="inline mr-2" /> admin@school.edu
        </div>
      </div>
    );
  }

  // Calculate Metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = attendance.find(a => a.date === todayStr);
  const todaysStatus = todayRecord ? todayRecord.status : 'Not Marked Yet';
  
  // Monthly %
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyRecords = attendance.filter(a => {
    const d = new Date(a.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  
  const presents = monthlyRecords.filter(a => ['Present', 'Late', 'Half Day'].includes(a.status)).length;
  // Exclude Leave & Medical Leave from denominator
  const validDays = monthlyRecords.filter(a => !['Leave', 'Medical Leave'].includes(a.status)).length;
  const monthlyPerc = validDays > 0 ? ((presents / validDays) * 100).toFixed(1) : 0;

  // Streak
  let consecutiveAbsences = 0;
  for (let i = 0; i < attendance.length; i++) {
    if (attendance[i].status === 'Absent') consecutiveAbsences++;
    else break;
  }

  const getStatusColor = (status) => {
    if (status.includes('Present')) return 'text-green-600 bg-green-50 border-green-200';
    if (status.includes('Absent')) return 'text-red-600 bg-red-50 border-red-200';
    if (status.includes('Late')) return 'text-amber-600 bg-amber-50 border-amber-200';
    if (status.includes('Leave')) return 'text-purple-600 bg-purple-50 border-purple-200';
    return 'text-slate-600 bg-slate-50 border-slate-200';
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <div className="page-header mb-6">
        <div>
          <h1>Parent Dashboard</h1>
          <p>Monitor your child's attendance and alerts.</p>
        </div>
      </div>

      {linkedStudents.length > 1 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {linkedStudents.map(student => (
            <button 
              key={student.id} 
              className={`px-4 py-2 rounded-full border ${selectedStudent?.id === student.id ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200'}`}
              onClick={() => handleSelectStudent(student)}
            >
              {student.name} ({student.classes?.name})
            </button>
          ))}
        </div>
      )}

      {selectedStudent && (
        <>
          {/* Top KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="card p-4 border-l-4 border-l-blue-500 shadow-sm flex items-center gap-4">
              {selectedStudent.picture_url ? (
                <img src={selectedStudent.picture_url} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }} alt="student" />
              ) : (
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={24} className="text-slate-400" />
                </div>
              )}
              <div>
                <h3 className="font-bold text-lg">{selectedStudent.name}</h3>
                <p className="text-sm text-slate-500">Roll: {selectedStudent.roll_no} | Class: {selectedStudent.classes?.name} {selectedStudent.classes?.section}</p>
              </div>
            </div>

            <div className={`card p-4 border flex flex-col justify-center items-center ${getStatusColor(todaysStatus)} shadow-sm`}>
              <h3 className="text-sm font-bold opacity-70 mb-1 uppercase tracking-wider">Today's Status</h3>
              <p className="text-2xl font-black">{todaysStatus}</p>
            </div>

            <div className="card p-4 border shadow-sm flex flex-col justify-center items-center bg-white border-slate-200">
              <h3 className="text-sm font-bold text-slate-500 mb-1 uppercase tracking-wider">Monthly Attendance</h3>
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={`${(monthlyPerc / 100) * 175} 175`} className={monthlyPerc < 75 ? 'text-red-500' : monthlyPerc < 90 ? 'text-amber-500' : 'text-green-500'} />
                </svg>
                <span className="absolute text-sm font-bold">{monthlyPerc}%</span>
              </div>
            </div>

            <div className={`card p-4 border flex flex-col justify-center items-center shadow-sm ${consecutiveAbsences >= 3 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-700'}`}>
              <h3 className="text-sm font-bold opacity-70 mb-1 uppercase tracking-wider">Consecutive Absences</h3>
              <div className="flex items-center gap-2">
                <AlertTriangle size={24} className={consecutiveAbsences >= 3 ? 'text-red-500' : 'text-slate-300'} />
                <p className="text-3xl font-black">{consecutiveAbsences}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: History & Trends */}
            <div className="col-span-1 lg:col-span-2 space-y-6">
              
              {/* Attendance Calendar / History */}
              <div className="card p-0 shadow-sm border border-slate-200 overflow-hidden">
                <h3 className="font-bold text-lg p-4 border-b bg-white flex items-center gap-2">
                  <Calendar size={18} className="text-primary" /> Recent Attendance History
                </h3>
                <div className="p-0">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="p-3 font-bold text-sm text-slate-600">Date</th>
                        <th className="p-3 font-bold text-sm text-slate-600">Status</th>
                        <th className="p-3 font-bold text-sm text-slate-600">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.slice(0, 10).map(att => (
                        <tr key={att.id} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="p-3 text-sm font-medium">{new Date(att.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold border ${getStatusColor(att.status)}`}>
                              {att.status}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-slate-500 italic">{att.remarks || '-'}</td>
                        </tr>
                      ))}
                      {attendance.length === 0 && (
                        <tr><td colSpan="3" className="p-4 text-center text-slate-500">No attendance records found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Right Column: Alerts & Contacts */}
            <div className="col-span-1 space-y-6">
              
              {/* Alerts Widget */}
              <div className="card p-0 shadow-sm border border-slate-200 overflow-hidden">
                <h3 className="font-bold text-lg p-4 border-b bg-white flex items-center gap-2">
                  <AlertCircle size={18} className="text-red-500" /> System Alerts
                </h3>
                <div className="p-4 bg-slate-50 h-64 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <div className="text-center text-slate-500 mt-8">
                      <CheckCircle size={32} className="mx-auto mb-2 text-green-400 opacity-50" />
                      <p className="text-sm">No active alerts for this student.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {alerts.slice(0, 5).map(alert => (
                        <div key={alert.id} className={`p-3 rounded-lg border ${alert.status === 'open' ? 'bg-white border-red-200 shadow-sm' : 'bg-slate-100 border-slate-200 opacity-70'}`}>
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${alert.priority === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {alert.alert_type}
                            </span>
                            <span className="text-xs text-slate-400">{new Date(alert.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm text-slate-700 mt-2">{alert.message}</p>
                          {alert.status === 'resolved' && (
                            <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><CheckCircle size={12} /> Resolved</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="card p-4 shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Phone size={18} className="text-primary" /> Contact Information
                </h3>
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded border">
                    <h4 className="font-bold text-sm text-slate-700 mb-1">Class Teacher</h4>
                    <p className="text-sm text-slate-600 flex items-center gap-2"><User size={14} /> Contact via School Portal</p>
                    <p className="text-xs text-slate-500 mt-1">Class {classInfo?.name} {classInfo?.section}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded border">
                    <h4 className="font-bold text-sm text-slate-700 mb-1">School Administration</h4>
                    <p className="text-sm text-slate-600 flex items-center gap-2 mb-1"><Phone size={14} /> +1 (555) 123-4567</p>
                    <p className="text-sm text-slate-600 flex items-center gap-2"><Mail size={14} /> admin@school.edu</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default ParentPortal;
