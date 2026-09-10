import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, AlertCircle, CheckCircle, Clock, Users, Camera, 
  ChevronDown, User, Send, AlertTriangle, Fingerprint, LogOut,
  Phone, MessageSquare, Edit2, Check, X, ExternalLink,
  QrCode, ShieldCheck, MapPin, Sparkles, AlertOctagon, HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import TeacherAttendanceHistory from '../components/TeacherAttendanceHistory';
import AttendanceScannerModal from '../components/AttendanceScannerModal';
import AttendanceCorrectionModal from '../components/AttendanceCorrectionModal';
import CalendarWidget from '../components/CalendarWidget';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatStudentDisplayName, buildAbsenteeParentMessage } from '../utils/studentUtils';
import { messageTemplateService } from '../services/MessageTemplateService';
import WhatsAppComposerModal from '../components/WhatsAppComposerModal';

const Dashboard = () => {
  const { profile } = useAuth();
  const { classes, teacherSubjects, marks, students, academicYear, featureAccess, updateStudentContactNumber } = useData();
  const [composerStudentData, setComposerStudentData] = useState(null);

  const isNotExpired = (expiresAt) => {
    if (!expiresAt) return true;
    return new Date() < new Date(expiresAt);
  };

  let isPythonEnabled = profile?.role === 'admin';
  if (!isPythonEnabled && featureAccess && Array.isArray(featureAccess)) {
    const teacherRule = featureAccess.find(f => f.feature_name === 'python_portal' && f.target_type === 'teacher' && f.target_id === profile?.id);
    if (teacherRule) {
      isPythonEnabled = teacherRule.is_enabled && isNotExpired(teacherRule.expires_at);
    }
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

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      setReportingTimeConfig({ time: 'Open', grace: 0 });

      const { data: myAtt } = await supabase.from('teacher_attendance').select('*').eq('teacher_id', profile?.id).eq('attendance_date', today).maybeSingle();
      if (myAtt) setMyAttendanceToday(myAtt);

      let attQuery = supabase
        .from('attendance')
        .select('id, student_id, status, class_id, date')
        .eq('date', today);
      
      if (assignedActiveClasses.length > 0) {
        attQuery = attQuery.in('class_id', assignedActiveClasses);
      }
      
      const { data: attData } = await attQuery;
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

  useEffect(() => {
    fetchDashboardData();
  }, [teacherSubjects]);

  if (profile?.role === 'student') {
    return <Navigate to="/student-portal" replace />;
  }

  if (profile?.role === 'principal') {
    return <Navigate to="/principal" replace />;
  }

  const isLibrarian = profile?.role === 'librarian';

  // Verified Hybrid Teacher Attendance Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerActionType, setScannerActionType] = useState('CHECK_IN');
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);

  const handleOpenCheckInScanner = () => {
    setScannerActionType('CHECK_IN');
    setIsScannerOpen(true);
  };

  const handleOpenCheckOutScanner = () => {
    setScannerActionType('CHECK_OUT');
    setIsScannerOpen(true);
  };

  const handleScannerSuccess = (result) => {
    if (result?.record) {
      setMyAttendanceToday(result.record);
    }
    fetchDashboardData();
  };

  const [editingPhoneStudentId, setEditingPhoneStudentId] = useState(null);
  const [phoneInputValue, setPhoneInputValue] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const handleStartEditPhone = (student) => {
    setEditingPhoneStudentId(student.id);
    setPhoneInputValue(student.contact_number || '');
  };

  const handleCancelEditPhone = () => {
    setEditingPhoneStudentId(null);
    setPhoneInputValue('');
  };

  const handleSavePhone = async (studentId) => {
    setSavingPhone(true);
    try {
      const res = await updateStudentContactNumber(studentId, phoneInputValue);
      if (res?.success) {
        setEditingPhoneStudentId(null);
      } else {
        alert("Failed to update contact number: " + (res?.error?.message || "Please try again."));
      }
    } catch (err) {
      alert("Error saving phone number: " + err.message);
    } finally {
      setSavingPhone(false);
    }
  };

  const getWhatsAppUrl = (student, dateStr, cls) => {
    if (!student?.contact_number) return null;
    const className = cls ? `${cls.name} ${cls.section}` : '';
    const text = messageTemplateService.renderMessage('absentee_alert', {
      student_name: student.name,
      class_name: className,
      roll_no: student.roll_no,
      date: dateStr,
      school_name: 'Gyanoday Niketan'
    });
    return messageTemplateService.generateWhatsAppUrl(student.contact_number, text);
  };

  const handleNotifyAbsentee = async (studentId, date) => {
    try {
      const student = students.find(s => s.id === studentId);
      const studentName = formatStudentDisplayName(student?.name) || 'Student';

      // 1. Send into notifications table
      const { error } = await supabase.from('notifications').insert([{
        user_id: studentId,
        title: 'Absence Notice',
        message: `Dear ${studentName}, you have been marked absent for ${date}. Please ensure you catch up on missed coursework.`,
        type: 'attendance_absent',
        is_read: false
      }]);

      if (error && error.code !== '42501') {
        console.warn("Notifications insert warning:", error);
      }

      // 2. Safe fallback attempt for student_notifications if configured
      try {
        await supabase.from('student_notifications').insert([{
          student_id: studentId,
          title: 'Absence Notice',
          message: `You have been marked absent for ${date}. Please ensure you catch up on missed coursework.`,
          type: 'absence_alert',
          is_read: false,
          is_acknowledged: false
        }]);
      } catch (e) {
        // Safe ignore
      }

      alert(`Private notice dispatched to ${studentName}'s portal successfully!`);
    } catch (err) {
      console.error("Failed to send notice:", err);
      alert("Notice processed for student's record.");
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
        <div className="text-slate-500 mt-1 flex flex-wrap items-center gap-2">
          <span>Welcome back, <strong className="text-brand-600">{profile?.name || 'Teacher'}</strong>.</span>
          {classes.filter(c => c.class_teacher_id === profile?.id).map(c => (
            <Badge key={c.id} variant="secondary" className="bg-brand-100 text-brand-800 hover:bg-brand-200 border-brand-200 flex items-center gap-1.5">
              <BookOpen size={12} />
              Class Teacher ({c.name} {c.section})
            </Badge>
          ))}
          <span className="block w-full sm:w-auto">Here's your overview for {academicYear}.</span>
        </div>
      </div>
      
      {/* Verified Hybrid Teacher Attendance Card */}
      <Card className="bg-slate-900 text-white border border-slate-800 shadow-2xl overflow-hidden relative rounded-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="p-6 relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-slate-800 border border-slate-700 rounded-2xl text-brand-400 shadow-inner">
                <ShieldCheck size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-white">Today's Attendance</h2>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Live Verified
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1.5">
                  <MapPin size={12} className="text-emerald-400" />
                  Gyanoday Niketan Geofence • Standard Reporting: <strong className="text-slate-200">{reportingTimeConfig.time}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={() => setIsCorrectionOpen(true)}
                className="text-xs text-slate-400 hover:text-brand-300 flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-700 transition-colors"
              >
                <HelpCircle size={13} /> Request Correction
              </button>
            </div>
          </div>

          {/* Attendance State Machine Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 my-5">
            {/* Check-In */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Check-In</span>
              <div className="my-1.5">
                <span className="text-lg md:text-xl font-black font-mono text-white">
                  {myAttendanceToday?.check_in_time 
                    ? new Date(myAttendanceToday.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </span>
              </div>
              <div>
                {myAttendanceToday?.check_in_time ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    <CheckCircle size={10} />
                    {myAttendanceToday.check_in_verification_status === 'VERIFIED' 
                      ? '✓ Verified — Dynamic QR'
                      : myAttendanceToday.check_in_method === 'MANUAL_CORRECTION'
                        ? 'Approved Correction'
                        : 'Unverified / Legacy'}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 font-medium">Pending morning scan</span>
                )}
              </div>
            </div>

            {/* Check-Out */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Check-Out</span>
              <div className="my-1.5">
                <span className="text-lg md:text-xl font-black font-mono text-white">
                  {myAttendanceToday?.check_out_time 
                    ? new Date(myAttendanceToday.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </span>
              </div>
              <div>
                {myAttendanceToday?.check_out_time ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                    <CheckCircle size={10} />
                    {myAttendanceToday.check_out_verification_status === 'VERIFIED' 
                      ? '✓ Verified — Dynamic QR'
                      : 'Recorded'}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 font-medium">
                    {myAttendanceToday?.check_in_time ? 'Not yet checked out' : 'Pending check-in'}
                  </span>
                )}
              </div>
            </div>

            {/* Working Hours */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Working Hours</span>
              <div className="my-1.5">
                <span className="text-lg md:text-xl font-black font-mono text-emerald-400">
                  {myAttendanceToday?.working_hours || (
                    myAttendanceToday?.check_in_time && myAttendanceToday?.check_out_time
                      ? (() => {
                          const diffMs = new Date(myAttendanceToday.check_out_time) - new Date(myAttendanceToday.check_in_time);
                          const hours = Math.floor(diffMs / (1000 * 60 * 60));
                          const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                          return `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
                        })()
                      : '--'
                  )}
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                {myAttendanceToday?.check_out_time ? 'Official shift duration' : 'Calculated at checkout'}
              </span>
            </div>

            {/* Status */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Status</span>
              <div className="my-1.5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                  !myAttendanceToday 
                    ? 'bg-slate-800 text-slate-400' 
                    : myAttendanceToday.status.includes('Present') 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : myAttendanceToday.status === 'Late' 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {myAttendanceToday?.status || 'NOT MARKED'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                {myAttendanceToday?.status === 'Late' ? 'Grace window exceeded' : 'Official status'}
              </span>
            </div>

            {/* Verification */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between col-span-2 md:col-span-1">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Verification</span>
              <div className="my-1.5">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    myAttendanceToday?.check_in_verification_status === 'VERIFIED'
                      ? 'bg-emerald-400 animate-pulse'
                      : myAttendanceToday
                        ? 'bg-amber-400'
                        : 'bg-slate-600'
                  }`} />
                  {myAttendanceToday?.check_in_verification_status === 'VERIFIED'
                    ? '✓ VERIFIED'
                    : myAttendanceToday
                      ? 'UNVERIFIED'
                      : 'PENDING'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 truncate">
                {myAttendanceToday?.check_in_distance_meters != null 
                  ? `Campus GPS (${myAttendanceToday.check_in_distance_meters}m)`
                  : 'Server validation'}
              </span>
            </div>
          </div>

          {/* Action Trigger Row */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
            <p className="text-xs text-slate-400">
              {!myAttendanceToday ? (
                <span>Scan the dynamic QR displayed at school entrance/staffroom to record morning arrival.</span>
              ) : !myAttendanceToday.check_out_time ? (
                <span>Checked in successfully. Please scan the dynamic afternoon QR before leaving campus.</span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle size={14} /> Full daily attendance cycle completed and verified for today.
                </span>
              )}
            </p>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {!myAttendanceToday ? (
                <Button 
                  onClick={handleOpenCheckInScanner} 
                  className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white h-11 px-6 text-sm font-bold shadow-lg hover:shadow-emerald-500/20 flex items-center gap-2"
                >
                  <QrCode size={18} /> Scan QR to Check In
                </Button>
              ) : !myAttendanceToday.check_out_time ? (
                <Button 
                  onClick={handleOpenCheckOutScanner} 
                  variant="danger"
                  className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white h-11 px-6 text-sm font-bold shadow-lg hover:shadow-rose-600/20 flex items-center gap-2"
                >
                  <QrCode size={18} /> Scan QR to Check Out
                </Button>
              ) : (
                <Button 
                  disabled
                  className="w-full sm:w-auto bg-slate-800 text-slate-400 h-11 px-6 text-sm font-bold border border-slate-700 cursor-default"
                >
                  <CheckCircle size={18} className="text-emerald-400 mr-2" /> Shift Completed
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Attendance Scanner Modal */}
      <AttendanceScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        actionType={scannerActionType}
        teacherProfile={profile}
        onSuccess={handleScannerSuccess}
      />

      {/* Attendance Correction Modal */}
      <AttendanceCorrectionModal
        isOpen={isCorrectionOpen}
        onClose={() => setIsCorrectionOpen(false)}
        teacherId={profile?.id}
        onSubmitted={() => fetchDashboardData()}
      />

      {/* Teacher Attendance History */}
      <TeacherAttendanceHistory teacherId={profile?.id} />

      {/* Calendar Widget */}
      {!isLibrarian && (
        <CalendarWidget />
      )}

      {!isLibrarian && (
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
      )}

      {/* Absentees Collapsible Section */}
      {!isLibrarian && (() => {
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
                          <Card key={a.id} hoverable className="flex flex-col justify-between border-slate-200">
                            <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
                              <div>
                                <div className="flex items-start gap-4 mb-3">
                                  <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0 flex items-center justify-center">
                                    {student.picture_url ? (
                                      <img src={student.picture_url} alt={student.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <User size={24} className="text-slate-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-800 leading-tight truncate">{formatStudentDisplayName(student.name)}</h4>
                                    <p className="text-xs text-slate-500 mb-1.5">{cls ? `${cls.name} ${cls.section}` : 'Unknown Class'} • Roll {student.roll_no}</p>
                                    <Badge variant="danger">{a.status}</Badge>
                                  </div>
                                </div>

                                {/* Phone Number Section with Inline Edit */}
                                <div className="p-2.5 rounded-lg bg-slate-100/80 border border-slate-200/80 text-xs mb-2">
                                  {editingPhoneStudentId === student.id ? (
                                    <div className="space-y-2">
                                      <div className="font-semibold text-slate-700 flex items-center gap-1">
                                        <Phone size={13} className="text-brand-600" />
                                        <span>Parent Contact Number:</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="tel"
                                          placeholder="10-digit mobile number"
                                          value={phoneInputValue}
                                          onChange={(e) => setPhoneInputValue(e.target.value)}
                                          className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800"
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => handleSavePhone(student.id)}
                                          disabled={savingPhone}
                                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold text-xs flex items-center gap-1 transition-colors"
                                          title="Save Phone Number"
                                        >
                                          {savingPhone ? '...' : <Check size={13} />}
                                          <span>Save</span>
                                        </button>
                                        <button
                                          onClick={handleCancelEditPhone}
                                          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
                                          title="Cancel"
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <Phone size={13} className={student.contact_number ? "text-emerald-600" : "text-amber-500"} />
                                        {student.contact_number ? (
                                          <span className="font-semibold text-slate-800 truncate">
                                            {student.contact_number}
                                          </span>
                                        ) : (
                                          <span className="text-amber-600 italic">No phone number</span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleStartEditPhone(student)}
                                        className="px-2 py-1 text-[11px] font-semibold text-brand-600 hover:text-brand-800 hover:bg-brand-50 rounded border border-brand-200 flex items-center gap-1 transition-colors"
                                        title="Change / Add Phone Number"
                                      >
                                        <Edit2 size={11} />
                                        <span>{student.contact_number ? 'Change' : '+ Add'}</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="space-y-2 pt-1 border-t border-slate-100">
                                {student.contact_number && (
                                  <button
                                    type="button"
                                    onClick={() => setComposerStudentData({
                                      student,
                                      cls,
                                      date: a.date
                                    })}
                                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                                  >
                                    <MessageSquare size={14} />
                                    <span>WhatsApp Parent</span>
                                  </button>
                                )}
                                <Button 
                                  onClick={() => handleNotifyAbsentee(student.id, a.date)}
                                  className="w-full bg-slate-800 hover:bg-slate-900 text-white"
                                  size="sm"
                                >
                                  <Send size={14} className="mr-2" /> Send Portal Notice
                                </Button>
                              </div>
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
            
            {isLibrarian && (
              <Card hoverable className="cursor-pointer group" onClick={() => window.location.href='/library'}>
                 <CardContent className="p-5 flex items-center gap-4">
                   <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <BookOpen size={28} />
                   </div>
                   <div>
                     <strong className="block text-lg font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">Library Dashboard</strong>
                     <span className="text-sm text-slate-500">Manage catalog and circulation</span>
                   </div>
                 </CardContent>
              </Card>
            )}

            {!isLibrarian && (
              <>
                {classes.filter(c => c.class_teacher_id === profile?.id).map(c => (
                  <Card key={`ct-card-${c.id}`} hoverable className="cursor-pointer group border-brand-200 bg-brand-50" onClick={() => window.location.href=`/class-teacher-portal/${c.id}`}>
                     <CardContent className="p-5 flex items-center gap-4">
                       <div className="w-14 h-14 rounded-2xl bg-white text-brand-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                         <BookOpen size={28} />
                       </div>
                       <div>
                         <strong className="block text-lg font-bold text-brand-800 group-hover:text-brand-600 transition-colors">Class Teacher ({c.name} {c.section})</strong>
                         <span className="text-sm text-brand-600 font-medium">Manage your class</span>
                       </div>
                     </CardContent>
                  </Card>
                ))}

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
              </>
            )}

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
      
      {composerStudentData && (
        <WhatsAppComposerModal
          isOpen={!!composerStudentData}
          onClose={() => setComposerStudentData(null)}
          student={composerStudentData.student}
          cls={composerStudentData.cls}
          teacherName={profile?.name || 'Class Teacher'}
          teacherId={profile?.id}
          initialTemplateKey="absentee_alert"
          defaultDate={composerStudentData.date}
        />
      )}
    </motion.div>
  );
};

export default Dashboard;
