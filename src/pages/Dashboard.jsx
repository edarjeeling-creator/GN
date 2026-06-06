import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { BookOpen, AlertCircle, CheckCircle, Clock, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

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

  useEffect(() => {
    if (assignedActiveClasses.length > 0) {
      fetchDashboardData();
    }
  }, [teacherSubjects]);

  const fetchDashboardData = async () => {
    try {
      // Fetch today's attendance for assigned classes
      const today = new Date().toISOString().split('T')[0];
      const { data: attData } = await supabase
        .from('attendance')
        .select('status, class_id')
        .eq('date', today)
        .in('class_id', assignedActiveClasses);
      setAttendanceData(attData || []);

      // Fetch open alerts for assigned classes
      const { data: alertData } = await supabase
        .from('system_alerts')
        .select('alert_type, status, class_id')
        .eq('status', 'open')
        .in('class_id', assignedActiveClasses);
      setAlerts(alertData || []);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  };

  // Calculate Attendance Stats
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

      </div>
      
      {/* Interactive Quick Actions (Placeholder) */}
      <div style={{ marginTop: '3rem' }}>
         <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Quick Actions</h3>
         <div className="bento-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="bento-card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1.5rem', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'border 0.2s' }} onMouseOver={e=>e.currentTarget.style.borderColor='var(--primary-color)'} onMouseOut={e=>e.currentTarget.style.borderColor='var(--border-color)'}>
               <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '1rem', color: '#3b82f6' }}><Users size={28} /></div>
               <div>
                 <strong style={{ display: 'block', fontSize: '1.1rem' }}>Enter Marks</strong>
                 <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Navigate to classes to input marks</span>
               </div>
            </div>
            <div className="bento-card" onClick={() => window.location.href='/attendance'} style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1.5rem', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'border 0.2s' }} onMouseOver={e=>e.currentTarget.style.borderColor='var(--primary-color)'} onMouseOut={e=>e.currentTarget.style.borderColor='var(--border-color)'}>
               <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '1rem', color: '#10b981' }}><CheckCircle size={28} /></div>
               <div>
                 <strong style={{ display: 'block', fontSize: '1.1rem' }}>Generate Reports</strong>
                 <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Review flowsheet and print cards</span>
               </div>
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
