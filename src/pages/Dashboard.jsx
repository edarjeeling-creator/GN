import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { BookOpen, AlertCircle, CheckCircle, Clock, Users, Camera, ChevronDown, User, Send, AlertTriangle, Fingerprint, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import TeacherAttendanceHistory from '../components/TeacherAttendanceHistory';

const Dashboard = () => {
  const { profile } = useAuth();
  const { classes, teacherSubjects, marks, students, academicYear, featureAccess } = useData();

  // Check if Python Portal is enabled for this teacher
  const isNotExpired = (expiresAt) => {
    if (!expiresAt) return true;
    return new Date() < new Date(expiresAt);
  };

  let isPythonEnabled = profile?.role === 'admin';
  if (!isPythonEnabled && featureAccess && Array.isArray(featureAccess)) {
    const teacherRule = featureAccess.find(f => f.feature_name === 'python_portal' && f.user_type === 'teacher' && f.user_id === profile?.id);
    if (teacherRule) {
      isPythonEnabled = teacherRule.is_enabled && isNotExpired(teacherRule.expires_at);
    }
  }
  if (profile?.role === 'student') {
    return <Navigate to="/student-portal" replace />;
  }



  // Calculate real stats based on filtered classes
  const assignedActiveClasses = Object.keys(teacherSubjects).filter(classId => classes.some(c => c.id === classId));
  const totalAssignedClasses = assignedActiveClasses.length;
  
  // Pending entries: For every assigned subject in every assigned class, every student should have 4 marks.
  let pendingEntries = 0;
  assignedActiveClasses.forEach(classId => {
    const classStudents = students.filter(s => s.class_id === classId);
    const subjectIds = teacherSubjects[classId] || [];
    
    // Only count classes that belong to the active year!
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    classStudents.forEach(student => {
      subjectIds.forEach(subId => {
        ['Midterm_Exam', 'Midterm_Test', 'Finalterm_Exam', 'Finalterm_Test'].forEach(term => {
          const fullTerm = `${academicYear}_${term}`;
          const key = `${student.id}_${subId}_${fullTerm}`;
          if (marks[key] === undefined || marks[key] === null || marks[key] === '') {
            pendingEntries++;
          }
        });
      });
    });
  });

  const [attendanceData, setAttendanceData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [showAbsentees, setShowAbsentees] = useState(false);
  const [myAttendanceToday, setMyAttendanceToday] = useState(null);
  const [reportingTimeConfig, setReportingTimeConfig] = useState({ time: '08:45', grace: 10 });
  const [attendanceActionLoading, setAttendanceActionLoading] = useState(false);
  const [recentNotices, setRecentNotices] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [teacherSubjects]);

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch Staff Attendance Rules
      const { data: settingsData } = await supabase.from('school_settings').select('*').in('setting_key', ['staff_reporting_time', 'staff_grace_period_mins']);
      let rTime = '08:45';
      let gMins = 10;
      if (settingsData) {
        settingsData.forEach(s => {
          if (s.setting_key === 'staff_reporting_time') rTime = s.setting_value;
          if (s.setting_key === 'staff_grace_period_mins') gMins = parseInt(s.setting_value) || 10;
        });
      }
      setReportingTimeConfig({ time: rTime, grace: gMins });

      // Fetch my attendance today
      const { data: myAtt } = await supabase.from('teacher_attendance').select('*').eq('teacher_id', profile.id).eq('attendance_date', today).maybeSingle();
      if (myAtt) setMyAttendanceToday(myAtt);

      const classIdFilter = assignedActiveClasses.length > 0 ? `class_id.in.(${assignedActiveClasses.join(',')}),` : '';
      
      const { data: attData } = await supabase
        .from('attendance')
        .select('id, student_id, status, class_id, date')
        .eq('date', today)
        .or(`${classIdFilter}marked_by.eq.${profile.id}`);
        
      setAttendanceData(attData || []);

      // Fetch open alerts for assigned classes
      if (assignedActiveClasses.length > 0) {
        const { data: alertData } = await supabase
          .from('system_alerts')
          .select('alert_type, status, class_id')
          .eq('status', 'open')
          .in('class_id', assignedActiveClasses);
        setAlerts(alertData || []);
      } else {
        setAlerts([]);
      }

      // Fetch notices for teachers
      const { data: noticesData } = await supabase
        .from('notices')
        .select('*')
        .in('target_audience', ['all', 'teachers'])
        .order('publish_date', { ascending: false })
        .limit(3);
      setRecentNotices(noticesData || []);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  };

  const handleCheckIn = async () => {
    setAttendanceActionLoading(true);
    
    const { data, error } = await supabase.rpc('check_in_teacher', {
      p_device_info: navigator.userAgent.substring(0, 200)
    });

    if (error) {
      alert("Failed to check in: " + error.message);
    } else if (data && data.error) {
      alert("Check-in Notice: " + data.error);
    } else {
      setMyAttendanceToday(data);
    }
    setAttendanceActionLoading(false);
  };

  const handleCheckOut = async () => {
    if (!myAttendanceToday || !myAttendanceToday.check_in_time) return;
    setAttendanceActionLoading(true);
    
    const { data, error } = await supabase.rpc('check_out_teacher');

    if (error) {
      alert("Failed to check out: " + error.message);
    } else if (data && data.error) {
      alert("Check-out Notice: " + data.error);
    } else {
      setMyAttendanceToday(data);
    }
    setAttendanceActionLoading(false);
  };

  const handleNotifyAbsentee = async (studentId, date) => {
    const { error } = await supabase.from('student_notifications').insert([{
      student_id: studentId,
      title: 'Absence Notice',
      message: `You have been marked absent for ${date}. Please ensure you catch up on missed coursework.`,
      type: 'absence_alert',
      is_read: false,
      is_acknowledged: false
    }]);

    if (!error) {
      alert("Private notice sent to student's portal successfully!");
    } else {
      alert("Failed to send notice: " + error.message);
    }
  };

  // Calculate Attendance Stats
  const handleProfileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      alert("File too large. Please select an image under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64Data = evt.target.result;
      
      const { error } = await supabase
        .from('profiles')
        .update({ picture_url: base64Data })
        .eq('id', profile.id);

      if (error) {
        alert("Failed to upload photo: " + error.message);
      } else {
        alert("Profile picture updated successfully!");
        window.location.reload();
      }
    };
    reader.readAsDataURL(file);
  };
  const presentToday = attendanceData.filter(a => ['Present', 'Late', 'Half Day'].includes(a.status)).length;
  const absentToday = attendanceData.filter(a => a.status === 'Absent').length;
  const leaveToday = attendanceData.filter(a => ['Leave', 'Medical Leave'].includes(a.status)).length;
  const studentsAtRisk = alerts.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <div className="page-header" style={{ borderBottom: 'none', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Welcome back, <strong style={{ color: 'var(--primary-color)' }}>{profile?.name || 'Teacher'}</strong>. Here's your overview for {academicYear}.</p>
        </div>
      </div>
      
      {/* Teacher Attendance Check-In Widget */}
      <div className="card bg-slate-900 text-white p-6 rounded-xl shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-slate-800 p-4 rounded-full border border-slate-700 shadow-inner">
              <Fingerprint size={32} className={myAttendanceToday ? 'text-green-400' : 'text-slate-400'} />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">My Daily Attendance</h2>
              <p className="text-slate-400 text-sm">
                Reporting Time: <strong className="text-slate-300">{reportingTimeConfig.time} AM</strong> (Grace: {reportingTimeConfig.grace} mins)
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 w-full md:w-auto">
            {!myAttendanceToday ? (
              <button 
                onClick={handleCheckIn} 
                disabled={attendanceActionLoading}
                className="w-full md:w-auto bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-green-500/20 transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-50"
              >
                <Fingerprint size={20} /> Check In Now
              </button>
            ) : !myAttendanceToday.check_out_time ? (
              <div className="flex flex-col md:flex-row items-center gap-4 w-full">
                <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-lg text-center w-full md:w-auto">
                  <span className="block text-xs text-slate-400 uppercase font-bold mb-1">Status</span>
                  <span className={`font-bold ${myAttendanceToday.status.includes('Late') ? 'text-amber-400' : 'text-green-400'}`}>
                    Checked In: {new Date(myAttendanceToday.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <button 
                  onClick={handleCheckOut} 
                  disabled={attendanceActionLoading}
                  className="w-full md:w-auto bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-red-500/20 transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-50"
                >
                  <LogOut size={20} /> Check Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4 w-full bg-slate-800 border border-slate-700 p-4 rounded-xl">
                <div className="bg-green-500/20 p-2 rounded-full"><CheckCircle className="text-green-400" size={24} /></div>
                <div>
                  <h4 className="font-bold text-slate-200">Shift Completed</h4>
                  <p className="text-sm text-slate-400">Total Hours: <strong className="text-white">{myAttendanceToday.working_hours}</strong></p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attendance History */}
      <TeacherAttendanceHistory teacherId={profile?.id} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Core KPIs */}
        <div className="col-span-1 lg:col-span-2 bento-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: 0 }}>
          <motion.div whileHover={{ y: -5 }} className="bento-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>My Classes</h3>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={24} />
              </div>
            </div>
            <p style={{ fontSize: '3rem', fontWeight: 900, color: '#3b82f6', lineHeight: 1 }}>{totalAssignedClasses}</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Active classes assigned to you</p>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="bento-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Pending Entries</h3>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={24} />
              </div>
            </div>
            <p style={{ fontSize: '3rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{pendingEntries}</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Marks requiring input this term</p>
          </motion.div>
        </div>

        {/* Class Attendance Overview Widget */}
        <div className="col-span-1">
          <motion.div whileHover={{ y: -5 }} className="bento-card h-full" style={{ padding: '1.5rem', borderTop: '4px solid #10b981', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Today's Attendance</h3>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={24} />
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-center space-y-4">
              <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-100">
                <span className="font-bold text-slate-700">Present</span>
                <span className="font-black text-green-600 text-xl">{presentToday}</span>
              </div>
              <div className="flex justify-between items-center bg-red-50 p-3 rounded-lg border border-red-100">
                <span className="font-bold text-slate-700">Absent</span>
                <span className="font-black text-red-600 text-xl">{absentToday}</span>
              </div>
              <div className="flex justify-between items-center bg-purple-50 p-3 rounded-lg border border-purple-100">
                <span className="font-bold text-slate-700">On Leave</span>
                <span className="font-black text-purple-600 text-xl">{leaveToday}</span>
              </div>
              <div className="flex justify-between items-center bg-amber-50 p-3 rounded-lg border border-amber-100 mt-2">
                <span className="font-bold text-amber-800 flex items-center gap-2"><AlertCircle size={16}/> Students At Risk</span>
                <span className="font-black text-amber-600 text-xl">{studentsAtRisk}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Absentees Collapsible Section */}
      {(() => {
        const absentees = attendanceData.filter(a => a.status === 'Absent' || a.status === 'Leave');
        if (absentees.length === 0) return null;

        return (
          <div className="card p-0 overflow-hidden shadow-sm border border-slate-200 mb-8">
            <button 
              className="w-full bg-white p-4 flex justify-between items-center text-left hover:bg-slate-50 transition-colors"
              onClick={() => setShowAbsentees(!showAbsentees)}
            >
              <div className="flex items-center gap-3">
                <div className="bg-red-100 p-2 rounded-full"><AlertTriangle className="text-red-600" size={20} /></div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800">Absent Students List</h3>
                  <p className="text-sm text-slate-500">View details and privately notify students ({absentees.length} records)</p>
                </div>
              </div>
              <ChevronDown size={24} className={`text-slate-400 transition-transform ${showAbsentees ? 'rotate-180' : ''}`} />
            </button>
            
            {showAbsentees && (
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {absentees.map(a => {
                    const student = students.find(s => s.id === a.student_id);
                    const cls = classes.find(c => c.id === a.class_id);
                    if (!student) return null;
                    
                    return (
                      <div key={a.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0 flex items-center justify-center">
                            {student.picture_url ? (
                              <img src={student.picture_url} alt={student.name} className="w-full h-full object-cover" />
                            ) : (
                              <User size={24} className="text-slate-400" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 leading-tight">{student.name}</h4>
                            <p className="text-xs text-slate-500 mb-1">{cls ? `${cls.name} ${cls.section}` : 'Unknown Class'} • Roll {student.roll_no}</p>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-800">{a.status}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleNotifyAbsentee(student.id, a.date)}
                          className="w-full py-2 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                          <Send size={14} /> Send Private Notice
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Recent Notices */}
      {recentNotices.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={20} className="text-blue-500" /> Recent Notices
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            {recentNotices.map(notice => (
              <div key={notice.id} style={{ padding: '1.5rem', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontWeight: 'bold', fontSize: '1.1rem', margin: 0 }}>{notice.title}</h4>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', color: '#64748b' }}>{notice.target_audience}</span>
                </div>
                <div style={{ color: '#475569', fontSize: '0.95rem', marginBottom: '1rem' }} dangerouslySetInnerHTML={{ __html: notice.content }} />
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>{new Date(notice.publish_date).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Quick Actions (Placeholder) */}
      <div style={{ marginTop: '3rem' }}>
         <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Quick Actions</h3>
         <div className="bento-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="bento-card" onClick={() => window.location.href='/classes'} style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1.5rem', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'border 0.2s' }} onMouseOver={e=>e.currentTarget.style.borderColor='var(--primary-color)'} onMouseOut={e=>e.currentTarget.style.borderColor='var(--border-color)'}>
               <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '1rem', color: '#3b82f6' }}><Users size={28} /></div>
               <div>
                 <strong style={{ display: 'block', fontSize: '1.1rem' }}>Enter Marks</strong>
                 <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Navigate to classes to input marks</span>
               </div>
            </div>
            <div className="bento-card" onClick={() => window.location.href='/classes'} style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1.5rem', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'border 0.2s' }} onMouseOver={e=>e.currentTarget.style.borderColor='var(--primary-color)'} onMouseOut={e=>e.currentTarget.style.borderColor='var(--border-color)'}>
               <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '1rem', color: '#10b981' }}><CheckCircle size={28} /></div>
               <div>
                 <strong style={{ display: 'block', fontSize: '1.1rem' }}>Generate Reports</strong>
                 <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Select a class first to view reports</span>
               </div>
            </div>

            <div className="bento-card relative" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1.5rem', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'border 0.2s' }} onMouseOver={e=>e.currentTarget.style.borderColor='var(--primary-color)'} onMouseOut={e=>e.currentTarget.style.borderColor='var(--border-color)'}>
               <div style={{ background: '#f5f3ff', padding: '1rem', borderRadius: '1rem', color: '#8b5cf6' }}><Camera size={28} /></div>
               <div>
                 <strong style={{ display: 'block', fontSize: '1.1rem' }}>Profile Picture</strong>
                 <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Upload your faculty photo</span>
               </div>
               <input 
                 type="file" 
                 accept="image/*" 
                 onChange={handleProfileUpload}
                 style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer', width: '100%', height: '100%' }}
               />
            </div>
            
            {isPythonEnabled && (
              <div className="bento-card" onClick={() => window.location.href='/python-teacher'} style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1.5rem', cursor: 'pointer', border: '1px solid #bfdbfe', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', transition: 'border 0.2s' }} onMouseOver={e=>e.currentTarget.style.borderColor='#3b82f6'} onMouseOut={e=>e.currentTarget.style.borderColor='#bfdbfe'}>
                 <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '1rem', color: '#3b82f6', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🐍</div>
                 <div>
                   <strong style={{ display: 'block', fontSize: '1.1rem', color: '#1e40af' }}>Python Portal</strong>
                   <span style={{ color: '#3b82f6', fontSize: '0.9rem', fontWeight: 500 }}>Manage lessons & review code</span>
                 </div>
              </div>
            )}
         </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
