import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { BookOpen, AlertCircle, CheckCircle, Clock, Users, Camera, ChevronDown, User, Send, AlertTriangle, Fingerprint, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import TeacherAttendanceHistory from '../components/TeacherAttendanceHistory';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

const Dashboard = () => {
  const { profile } = useAuth();
  const { classes, teacherSubjects, marks, students, academicYear, featureAccess } = useData();

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

  const assignedActiveClasses = Object.keys(teacherSubjects).filter(classId => classes.some(c => c.id === classId));
  const totalAssignedClasses = assignedActiveClasses.length;
  
  let pendingEntries = 0;
  assignedActiveClasses.forEach(classId => {
    const classStudents = students.filter(s => s.class_id === classId);
    const subjectIds = teacherSubjects[classId] || [];
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

      const { data: myAtt } = await supabase.from('teacher_attendance').select('*').eq('teacher_id', profile.id).eq('attendance_date', today).maybeSingle();
      if (myAtt) setMyAttendanceToday(myAtt);

      const classIdFilter = assignedActiveClasses.length > 0 ? `class_id.in.(${assignedActiveClasses.join(',')}),` : '';
      
      const { data: attData } = await supabase
        .from('attendance')
        .select('id, student_id, status, class_id, date')
        .eq('date', today)
        .or(`${classIdFilter}marked_by.eq.${profile.id}`);
        
      setAttendanceData(attData || []);

      if (assignedActiveClasses.length > 0) {
        const { data: alertData } = await supabase.from('system_alerts').select('alert_type, status, class_id').eq('status', 'open').in('class_id', assignedActiveClasses);
        setAlerts(alertData || []);
      } else {
        setAlerts([]);
      }

      const { data: noticesData } = await supabase.from('notices').select('*').in('target_audience', ['all', 'teachers']).order('publish_date', { ascending: false }).limit(3);
      setRecentNotices(noticesData || []);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  };

  const handleCheckIn = async () => {
    setAttendanceActionLoading(true);
    const { data, error } = await supabase.rpc('check_in_teacher', { p_device_info: navigator.userAgent.substring(0, 200) });

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
      const { error } = await supabase.from('profiles').update({ picture_url: base64Data }).eq('id', profile.id);

      if (error) alert("Failed to upload photo: " + error.message);
      else window.location.reload();
    };
    reader.readAsDataURL(file);
  };

  const presentToday = attendanceData.filter(a => ['Present', 'Late', 'Half Day'].includes(a.status)).length;
  const absentToday = attendanceData.filter(a => a.status === 'Absent').length;
  const leaveToday = attendanceData.filter(a => ['Leave', 'Medical Leave'].includes(a.status)).length;
  const studentsAtRisk = alerts.length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back, <strong className="text-brand-600">{profile?.name || 'Teacher'}</strong>. Here's your overview for {academicYear}.</p>
      </div>
      
      {/* Teacher Attendance Check-In Widget */}
      <Card className="bg-slate-900 text-white border-0 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
        <CardContent className="p-6 relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-slate-800 p-4 rounded-full border border-slate-700 shadow-inner">
              <Fingerprint size={32} className={myAttendanceToday ? 'text-emerald-400' : 'text-slate-400'} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-1">My Daily Attendance</h2>
              <p className="text-slate-400 text-sm">
                Reporting Time: <strong className="text-slate-300">{reportingTimeConfig.time} AM</strong> (Grace: {reportingTimeConfig.grace} mins)
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 w-full md:w-auto">
            {!myAttendanceToday ? (
              <Button 
                onClick={handleCheckIn} 
                isLoading={attendanceActionLoading}
                className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-600 text-white h-12 px-8 text-lg shadow-lg hover:shadow-emerald-500/20"
              >
                <Fingerprint size={20} className="mr-2" /> Check In Now
              </Button>
            ) : !myAttendanceToday.check_out_time ? (
              <div className="flex flex-col md:flex-row items-center gap-4 w-full">
                <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-lg text-center w-full md:w-auto">
                  <span className="block text-xs text-slate-400 uppercase font-bold mb-1">Status</span>
                  <span className={`font-bold ${myAttendanceToday.status.includes('Late') ? 'text-amber-400' : 'text-emerald-400'}`}>
                    Checked In: {new Date(myAttendanceToday.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <Button 
                  onClick={handleCheckOut} 
                  isLoading={attendanceActionLoading}
                  variant="danger"
                  className="w-full md:w-auto h-12 px-8 text-lg shadow-lg hover:shadow-red-500/20"
                >
                  <LogOut size={20} className="mr-2" /> Check Out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-4 w-full bg-slate-800 border border-slate-700 p-4 rounded-xl">
                <div className="bg-emerald-500/20 p-2 rounded-full"><CheckCircle className="text-emerald-400" size={24} /></div>
                <div>
                  <h4 className="font-bold text-slate-200">Shift Completed</h4>
                  <p className="text-sm text-slate-400">Total Hours: <strong className="text-white">{myAttendanceToday.working_hours}</strong></p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Teacher Attendance History */}
      <TeacherAttendanceHistory teacherId={profile?.id} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Core KPIs */}
        <Card hoverable className="border-t-4 border-t-brand-500 flex flex-col justify-between">
          <CardContent className="p-6 flex flex-col gap-4 h-full">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-bold text-slate-600">My Classes</h3>
              <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                <BookOpen size={20} />
              </div>
            </div>
            <div>
              <p className="text-4xl font-black text-brand-600 mb-1">{totalAssignedClasses}</p>
              <p className="text-sm text-slate-500">Active classes assigned to you</p>
            </div>
          </CardContent>
        </Card>

        <Card hoverable className="border-t-4 border-t-amber-500 flex flex-col justify-between">
          <CardContent className="p-6 flex flex-col gap-4 h-full">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-bold text-slate-600">Pending Entries</h3>
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
                <Clock size={20} />
              </div>
            </div>
            <div>
              <p className="text-4xl font-black text-amber-500 mb-1">{pendingEntries}</p>
              <p className="text-sm text-slate-500">Marks requiring input this term</p>
            </div>
          </CardContent>
        </Card>

        {/* Class Attendance Overview Widget */}
        <Card hoverable className="border-t-4 border-t-emerald-500 flex flex-col">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-600">Today's Attendance</h3>
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
                <Users size={20} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                <span className="font-semibold text-slate-700">Present</span>
                <span className="font-black text-emerald-600 text-lg">{presentToday}</span>
              </div>
              <div className="flex justify-between items-center bg-red-50/50 p-3 rounded-lg border border-red-100">
                <span className="font-semibold text-slate-700">Absent</span>
                <span className="font-black text-red-600 text-lg">{absentToday}</span>
              </div>
              <div className="flex justify-between items-center bg-purple-50/50 p-3 rounded-lg border border-purple-100">
                <span className="font-semibold text-slate-700">On Leave</span>
                <span className="font-black text-purple-600 text-lg">{leaveToday}</span>
              </div>
              <div className="flex justify-between items-center bg-amber-50/50 p-3 rounded-lg border border-amber-100 mt-2">
                <span className="font-semibold text-amber-800 flex items-center gap-1.5"><AlertCircle size={16}/> At Risk</span>
                <span className="font-black text-amber-600 text-lg">{studentsAtRisk}</span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Absentees Collapsible Section */}
      {(() => {
        const absentees = attendanceData.filter(a => a.status === 'Absent' || a.status === 'Leave');
        if (absentees.length === 0) return null;

        return (
          <Card className="overflow-hidden p-0 border-slate-200">
            <button 
              className="w-full bg-white p-5 flex justify-between items-center text-left hover:bg-slate-50 transition-colors focus:outline-none"
              onClick={() => setShowAbsentees(!showAbsentees)}
            >
              <div className="flex items-center gap-4">
                <div className="bg-red-100 p-2.5 rounded-full"><AlertTriangle className="text-red-600" size={20} /></div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800">Absent Students List</h3>
                  <p className="text-sm text-slate-500">View details and privately notify students ({absentees.length} records)</p>
                </div>
              </div>
              <ChevronDown size={24} className={`text-slate-400 transition-transform ${showAbsentees ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showAbsentees && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="p-6 bg-slate-50 border-t border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {absentees.map(a => {
                        const student = students.find(s => s.id === a.student_id);
                        const cls = classes.find(c => c.id === a.class_id);
                        if (!student) return null;
                        
                        return (
                          <Card key={a.id} hoverable className="flex flex-col justify-between">
                            <CardContent className="p-4">
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
                                  <p className="text-xs text-slate-500 mb-2">{cls ? `${cls.name} ${cls.section}` : 'Unknown Class'} • Roll {student.roll_no}</p>
                                  <Badge variant="danger">{a.status}</Badge>
                                </div>
                              </div>
                              <Button 
                                onClick={() => handleNotifyAbsentee(student.id, a.date)}
                                className="w-full bg-slate-800 hover:bg-slate-900 text-white"
                                size="sm"
                              >
                                <Send size={14} className="mr-2" /> Send Private Notice
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        );
      })()}

      {/* Recent Notices */}
      {recentNotices.length > 0 && (
        <div className="pt-4">
          <h3 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
            <AlertCircle size={24} className="text-brand-500" /> Recent Notices
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentNotices.map(notice => (
              <Card key={notice.id} hoverable className="h-full flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-brand-500"></div>
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <h4 className="font-bold text-lg leading-tight text-slate-800">{notice.title}</h4>
                    <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">{notice.target_audience}</Badge>
                  </div>
                  <div className="text-slate-600 text-sm mb-4 flex-1 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: notice.content }} />
                  <p className="text-xs text-slate-400 font-medium">{new Date(notice.publish_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions Bento Box */}
      <div className="pt-4">
         <h3 className="text-xl font-bold mb-4 text-slate-800">Quick Actions</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <Card hoverable className="cursor-pointer group" onClick={() => window.location.href='/classes'}>
               <CardContent className="p-5 flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Users size={28} />
                 </div>
                 <div>
                   <strong className="block text-lg font-semibold text-slate-800 group-hover:text-brand-600 transition-colors">Enter Marks</strong>
                   <span className="text-sm text-slate-500">Input marks for classes</span>
                 </div>
               </CardContent>
            </Card>
            
            <Card hoverable className="cursor-pointer group" onClick={() => window.location.href='/classes'}>
               <CardContent className="p-5 flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <CheckCircle size={28} />
                 </div>
                 <div>
                   <strong className="block text-lg font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">Reports</strong>
                   <span className="text-sm text-slate-500">Generate report cards</span>
                 </div>
               </CardContent>
            </Card>

            <Card hoverable className="cursor-pointer group relative overflow-hidden">
               <CardContent className="p-5 flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Camera size={28} />
                 </div>
                 <div>
                   <strong className="block text-lg font-semibold text-slate-800 group-hover:text-purple-600 transition-colors">Profile Photo</strong>
                   <span className="text-sm text-slate-500">Upload your picture</span>
                 </div>
                 <input 
                   type="file" 
                   accept="image/*" 
                   onChange={handleProfileUpload}
                   className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                 />
               </CardContent>
            </Card>
            
            {isPythonEnabled && (
              <Card hoverable className="cursor-pointer group border-brand-200 bg-gradient-to-br from-brand-50 to-indigo-50" onClick={() => window.location.href='/python-teacher'}>
                 <CardContent className="p-5 flex items-center gap-4">
                   <div className="w-14 h-14 rounded-2xl bg-white text-brand-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm text-2xl">
                     🐍
                   </div>
                   <div>
                     <strong className="block text-lg font-bold text-brand-800 group-hover:text-brand-600 transition-colors">Python Portal</strong>
                     <span className="text-sm text-brand-600 font-medium">Manage coding lessons</span>
                   </div>
                 </CardContent>
              </Card>
            )}
         </div>
      </div>
      
    </motion.div>
  );
};

export default Dashboard;
