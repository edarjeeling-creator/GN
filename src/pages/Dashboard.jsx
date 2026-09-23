import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, AlertCircle, CheckCircle, Clock, Users, Camera, 
  ChevronDown, User, Send, AlertTriangle,
  Phone, MessageSquare, Edit2, Check, X,
  QrCode, ShieldCheck, MapPin, HelpCircle,
  Printer, IdCard, Building2, Bell, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import TeacherAttendanceHistory from '../components/TeacherAttendanceHistory';
import AttendanceScannerModal from '../components/AttendanceScannerModal';
import AttendanceCorrectionModal from '../components/AttendanceCorrectionModal';
import CalendarWidget from '../components/CalendarWidget';
import DigitalStaffIDModal from '../components/DigitalStaffIDModal';
import NoticeDetailModal from '../components/NoticeDetailModal';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatStudentDisplayName } from '../utils/studentUtils';
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
  
  const assignedActiveClasses = useMemo(() => {
    return Object.keys(teacherSubjects).filter(classId => classes.some(c => c.id === classId));
  }, [teacherSubjects, classes]);

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
  const [reportingTimeConfig] = useState({ time: 'Open', grace: 0 });
  const [recentNotices, setRecentNotices] = useState([]);
  const [isIdModalOpen, setIsIdModalOpen] = useState(false);
  const [selectedNoticeForModal, setSelectedNoticeForModal] = useState(null);
  const [deletingNoticeId, setDeletingNoticeId] = useState(null);
  const [activeTopTab, setActiveTopTab] = useState('attendance'); // 'attendance' | 'notices'

  // Verified Hybrid Teacher Attendance Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerActionType, setScannerActionType] = useState('CHECK_IN');
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);

  // Quick edit phone number modal/inline state
  const [editingPhoneStudentId, setEditingPhoneStudentId] = useState(null);
  const [phoneInputValue, setPhoneInputValue] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

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

      let audienceFilter = ['all', 'staff'];
      if (profile?.role === 'group_d') {
        audienceFilter.push('group_d');
      } else if (['non_teaching', 'accountant', 'librarian'].includes(profile?.role)) {
        audienceFilter.push('non_teaching');
      } else {
        // Teacher, Admin, Principal, Coordinator
        audienceFilter.push('teachers');
        if (assignedActiveClasses && assignedActiveClasses.length > 0) {
          assignedActiveClasses.forEach(cid => audienceFilter.push(`class:${cid}`));
        }
      }

      const { data: noticesData } = await supabase
        .from('notices')
        .select('*')
        .in('target_audience', audienceFilter)
        .order('publish_date', { ascending: false })
        .limit(6);
      setRecentNotices(noticesData || []);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  }, [profile, assignedActiveClasses]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      await Promise.resolve();
      if (active) fetchDashboardData();
    };
    run();
    return () => { active = false; };
  }, [fetchDashboardData]);

  // Deep-link handling: if app is opened with ?noticeId=<uuid>, auto-open that notice
  const handledNoticeIdRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetNoticeId = params.get('noticeId');
    if (!targetNoticeId || handledNoticeIdRef.current === targetNoticeId) return;

    setActiveTopTab('notices');

    let isMounted = true;
    const loadDeepLinkedNotice = async () => {
      try {
        // Check if present in recentNotices
        const existing = recentNotices.find(n => n.id === targetNoticeId);
        if (existing) {
          handledNoticeIdRef.current = targetNoticeId;
          if (isMounted) setSelectedNoticeForModal(existing);
          return;
        }

        // Fetch directly from database
        const { data: fetchedNotice, error } = await supabase
          .from('notices')
          .select('*')
          .eq('id', targetNoticeId)
          .maybeSingle();

        if (!error && fetchedNotice && isMounted) {
          handledNoticeIdRef.current = targetNoticeId;
          setSelectedNoticeForModal(fetchedNotice);
        }
      } catch (err) {
        console.warn('Error loading deep-linked notice:', err);
      }
    };

    loadDeepLinkedNotice();

    return () => {
      isMounted = false;
    };
  }, [recentNotices]);

  if (profile?.role === 'student') {
    return <Navigate to="/student-portal" replace />;
  }

  if (profile?.role === 'principal') {
    return <Navigate to="/principal" replace />;
  }

  const isLibrarian = profile?.role === 'librarian';
  const isAccountant = profile?.role === 'accountant';
  const isPureSupportStaff = ['non_teaching', 'group_d', 'staff', 'accountant', 'librarian'].includes(profile?.role);
  const isAcademicFaculty = !isPureSupportStaff && (profile?.role === 'teacher' || profile?.role === 'admin' || profile?.role === 'coordinator');
  const isAdminOrHead = profile && (
    profile.role === 'admin' ||
    profile.role === 'principal' ||
    profile.role === 'coordinator' ||
    (profile.designation && profile.designation.toLowerCase().includes('coordinator'))
  );
  const isPrincipalOrAdmin = profile?.role === 'principal' || profile?.role === 'admin';

  const handleDeleteNoticeFromDashboard = async (noticeId, title) => {
    if (!window.confirm(`Are you sure you want to delete the notice "${title || 'Untitled'}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingNoticeId(noticeId);
    try {
      let { error } = await supabase.from('notices').delete().eq('id', noticeId);
      if (error) {
        const { error: rpcErr } = await supabase.rpc('delete_school_notice', { p_notice_id: noticeId });
        if (rpcErr) throw error || rpcErr;
      }

      setRecentNotices(prev => prev.filter(n => n.id !== noticeId));
      if (selectedNoticeForModal?.id === noticeId) {
        setSelectedNoticeForModal(null);
      }
    } catch (err) {
      console.error('Error deleting notice:', err);
      alert('Failed to delete notice: ' + (err.message || 'Unknown error'));
    } finally {
      setDeletingNoticeId(null);
    }
  };

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
      } catch {
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

  const getAttendanceStateDetails = () => {
    if (!myAttendanceToday || !myAttendanceToday.check_in_time) {
      return {
        key: 'NO_CHECK_IN',
        label: 'NO CHECK-IN',
        sublabel: 'Morning scan required',
        dotClass: 'bg-slate-600',
        badgeClass: 'text-slate-400'
      };
    }

    if (myAttendanceToday.check_out_time) {
      const isQRVerified = myAttendanceToday.check_out_verification_status === 'VERIFIED';
      return {
        key: 'CHECKED_OUT',
        label: isQRVerified ? '✓ QR VERIFIED' : 'CHECKED OUT',
        sublabel: isQRVerified
          ? `Campus GPS (${myAttendanceToday.check_out_distance_meters != null ? myAttendanceToday.check_out_distance_meters + 'm' : 'Verified'})`
          : 'Shift Completed',
        dotClass: isQRVerified ? 'bg-emerald-400' : 'bg-blue-400',
        badgeClass: isQRVerified ? 'text-emerald-400' : 'text-blue-400'
      };
    }

    if (myAttendanceToday.check_in_method === 'DYNAMIC_QR' && myAttendanceToday.check_in_verification_status === 'VERIFIED') {
      return {
        key: 'QR_VERIFIED',
        label: '✓ QR VERIFIED',
        sublabel: `Campus GPS (${myAttendanceToday.check_in_distance_meters != null ? myAttendanceToday.check_in_distance_meters + 'm' : 'Verified'})`,
        dotClass: 'bg-emerald-400 animate-pulse',
        badgeClass: 'text-emerald-400'
      };
    }

    if (myAttendanceToday.check_in_method === 'MANUAL_CORRECTION' || myAttendanceToday.check_in_verification_status === 'MANUALLY_APPROVED') {
      return {
        key: 'MANUAL_CORRECTION',
        label: 'MANUAL ENTRY',
        sublabel: 'Approved correction',
        dotClass: 'bg-blue-400',
        badgeClass: 'text-blue-400'
      };
    }

    if (myAttendanceToday.check_in_method === 'ADMIN_OVERRIDE' || myAttendanceToday.check_in_verification_status === 'ADMIN_VERIFIED') {
      return {
        key: 'ADMIN_RECORDED',
        label: 'ADMIN RECORDED',
        sublabel: 'Administrative override',
        dotClass: 'bg-blue-400',
        badgeClass: 'text-blue-400'
      };
    }

    return {
      key: 'UNVERIFIED',
      label: 'UNVERIFIED',
      sublabel: 'Direct record',
      dotClass: 'bg-amber-400',
      badgeClass: 'text-amber-400'
    };
  };

  const attState = getAttendanceStateDetails();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isPureSupportStaff ? 'Staff Portal' : 'Dashboard'}
          </h1>
          <div className="text-slate-600 dark:text-slate-300 mt-1.5 flex flex-wrap items-center gap-2 text-sm sm:text-base">
            <span>Welcome back, <strong className="text-brand-600 dark:text-brand-400 font-bold">{profile?.name || 'Staff Member'}</strong>.</span>
            {isPureSupportStaff ? (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700/60 font-bold">
                {profile?.designation || (profile?.role === 'group_d' ? 'Group D Staff' : profile?.role === 'accountant' ? 'School Accountant' : profile?.role === 'librarian' ? 'Librarian' : 'Non-Teaching Staff')}
              </Badge>
            ) : (
              classes.filter(c => c.class_teacher_id === profile?.id).map(c => (
                <Badge key={c.id} variant="secondary" className="bg-brand-100 text-brand-800 hover:bg-brand-200 border-brand-200 dark:bg-brand-950/70 dark:text-brand-300 dark:border-brand-700/60 flex items-center gap-1.5">
                  <BookOpen size={12} />
                  Class Teacher ({c.name} {c.section})
                </Badge>
              ))
            )}
            <span className="block w-full sm:w-auto text-slate-500 dark:text-slate-400">
              {profile?.campus ? `• ${profile.campus}` : ''} • Overview for {academicYear}.
            </span>
          </div>
        </div>

        {/* Digital Staff ID Card Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            onClick={() => setIsIdModalOpen(true)}
            variant="outline"
            className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-2 shadow-sm hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <IdCard size={18} className="text-emerald-500" />
            <span>Digital Staff ID</span>
          </Button>
        </div>
      </div>
      
      {/* Top Tab Navigation Menu */}
      <div 
        role="tablist" 
        aria-label="Dashboard top navigation"
        className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-2"
      >
        <div 
          className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              const nextTab = activeTopTab === 'attendance' ? 'notices' : 'attendance';
              setActiveTopTab(nextTab);
              document.getElementById(`tab-${nextTab}`)?.focus();
            }
          }}
        >
          <button
            id="tab-attendance"
            role="tab"
            type="button"
            aria-selected={activeTopTab === 'attendance'}
            aria-controls="panel-attendance"
            tabIndex={activeTopTab === 'attendance' ? 0 : -1}
            onClick={() => setActiveTopTab('attendance')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              activeTopTab === 'attendance'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck size={18} className={activeTopTab === 'attendance' ? 'text-white' : 'text-emerald-500 dark:text-emerald-400'} />
            <span>Today's Attendance</span>
            {myAttendanceToday?.check_in_time ? (
              <span 
                className={`w-2.5 h-2.5 rounded-full ${myAttendanceToday.check_out_time ? 'bg-emerald-400' : 'bg-emerald-400 animate-pulse'}`} 
                title={myAttendanceToday.check_out_time ? 'Shift Completed' : 'Checked In'}
              />
            ) : (
              <span 
                className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" 
                title="Pending check-in"
              />
            )}
          </button>

          <button
            id="tab-notices"
            role="tab"
            type="button"
            aria-selected={activeTopTab === 'notices'}
            aria-controls="panel-notices"
            tabIndex={activeTopTab === 'notices' ? 0 : -1}
            onClick={() => setActiveTopTab('notices')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 relative ${
              activeTopTab === 'notices'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Bell size={18} className={activeTopTab === 'notices' ? 'text-white' : 'text-amber-500 dark:text-amber-400'} />
            <span>Notices & Circulars</span>
            {recentNotices.length > 0 && (
              <span className={`px-2 py-0.5 text-xs font-black rounded-full transition-colors ${
                activeTopTab === 'notices'
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30'
              }`}>
                {recentNotices.length}
              </span>
            )}
          </button>
        </div>

        {/* Quick Context Summary */}
        <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:flex items-center gap-2">
          {activeTopTab === 'attendance' ? (
            <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
              <span className="text-slate-400">Status:</span>
              <strong className="text-slate-700 dark:text-slate-200 font-semibold">{myAttendanceToday?.status || 'Not Marked'}</strong>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
              <Bell size={13} className="text-brand-500" />
              <span>Showing <strong className="text-slate-700 dark:text-slate-200 font-semibold">{recentNotices.length}</strong> official circular{recentNotices.length === 1 ? '' : 's'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        {activeTopTab === 'attendance' ? (
          <motion.div
            key="panel-attendance"
            id="panel-attendance"
            role="tabpanel"
            aria-labelledby="tab-attendance"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
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
                            : myAttendanceToday.check_in_method === 'ADMIN_OVERRIDE' || myAttendanceToday.check_in_verification_status === 'ADMIN_VERIFIED'
                              ? 'Administrative Record'
                              : myAttendanceToday.check_in_method === 'MANUAL_CORRECTION'
                                ? 'Approved Correction'
                                : 'Recorded'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">Pending morning scan</span>
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
                        <span className="text-[11px] text-slate-400 font-medium">
                          {myAttendanceToday?.check_in_time ? 'Awaiting departure scan' : 'Pending check-in'}
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
                    <span className="text-[11px] text-slate-400 font-medium">
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
                    <span className="text-[11px] text-slate-400 font-medium">
                      {myAttendanceToday?.status === 'Late' ? 'Grace window exceeded' : 'Official status'}
                    </span>
                  </div>

                  {/* Verification */}
                  <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between col-span-2 md:col-span-1">
                    <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Verification</span>
                    <div className="my-1.5">
                      <span className={`text-xs font-black flex items-center gap-1.5 ${attState.badgeClass}`}>
                        <span className={`w-2 h-2 rounded-full ${attState.dotClass}`} />
                        {attState.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 truncate">
                      {attState.sublabel}
                    </span>
                  </div>
                </div>

                {/* Action Trigger Row */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
                  <p className="text-xs text-slate-400">
                    {!myAttendanceToday || !myAttendanceToday.check_in_time ? (
                      <span>No morning check-in recorded for today. Afternoon check-out requires a recorded morning arrival first. Please scan to check in or contact admin for correction.</span>
                    ) : !myAttendanceToday.check_out_time ? (
                      <span>Checked in successfully ({attState.label}). Please scan the dynamic afternoon QR before leaving campus.</span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle size={14} /> Full daily attendance cycle completed and verified for today.
                      </span>
                    )}
                  </p>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {!myAttendanceToday || !myAttendanceToday.check_in_time ? (
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

            {/* Teacher Attendance History */}
            <TeacherAttendanceHistory teacherId={profile?.id} />
          </motion.div>
        ) : (
          <motion.div
            key="panel-notices"
            id="panel-notices"
            role="tabpanel"
            aria-labelledby="tab-notices"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Pending Morning Check-In Reminder Banner */}
            {(!myAttendanceToday || !myAttendanceToday.check_in_time) && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-300 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400 shrink-0">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-amber-200">Morning Check-In Pending</h4>
                    <p className="text-xs text-amber-300/80">You have not recorded your arrival for today yet. Scan the school QR code to record your attendance.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <Button
                    size="sm"
                    onClick={handleOpenCheckInScanner}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <QrCode size={15} /> Scan Check In
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTopTab('attendance')}
                    className="w-full sm:w-auto border-amber-500/40 text-amber-200 hover:bg-amber-500/20 text-xs h-9 px-3"
                  >
                    View Attendance
                  </Button>
                </div>
              </div>
            )}

            {/* Notices Section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertCircle size={22} className="text-brand-500" /> Recent Notices & Circulars
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Official announcements, circulars, and schedules published for you
                  </p>
                </div>
                {recentNotices.length > 0 && (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 self-start sm:self-auto">
                    Showing latest {recentNotices.length} circular{recentNotices.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              {recentNotices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {recentNotices.map(notice => (
                    <Card 
                      key={notice.id} 
                      hoverable 
                      className="h-full flex flex-col relative overflow-hidden cursor-pointer group hover:border-brand-400 dark:hover:border-brand-600 transition-all bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md"
                      onClick={() => setSelectedNoticeForModal(notice)}
                    >
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-500"></div>
                      <CardContent className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-3 gap-2">
                            <h4 className="font-bold text-base sm:text-lg leading-snug text-slate-800 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2">
                              {notice.title}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge 
                                variant={notice.target_audience?.startsWith('class:') ? 'default' : 'secondary'} 
                                className={`uppercase text-[10px] tracking-wider font-semibold whitespace-nowrap shrink-0 ${
                                  notice.target_audience?.startsWith('class:')
                                    ? 'bg-brand-100 text-brand-800 border-brand-200 dark:bg-brand-950/80 dark:text-brand-300 dark:border-brand-800'
                                    : ''
                                }`}
                              >
                                {(() => {
                                  const aud = notice.target_audience;
                                  if (!aud || aud === 'all') return 'Entire School';
                                  if (aud === 'staff') return 'All Staff';
                                  if (aud === 'teachers') return 'Teachers';
                                  if (aud === 'non_teaching') return 'Non-Teaching';
                                  if (aud === 'group_d') return 'Group D';
                                  if (aud === 'students') return 'Students';
                                  if (aud.startsWith('class:')) {
                                    const cid = aud.replace('class:', '');
                                    const cls = classes.find(c => c.id === cid);
                                    return cls ? `Class ${cls.name} ${cls.section || ''}`.trim() : 'Class';
                                  }
                                  return aud;
                                })()}
                              </Badge>
                              {isPrincipalOrAdmin && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteNoticeFromDashboard(notice.id, notice.title);
                                  }}
                                  disabled={deletingNoticeId === notice.id}
                                  className="p-1 px-2 rounded-lg text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-900/40 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                                  title="Delete notice"
                                >
                                  <Trash2 size={12} className={deletingNoticeId === notice.id ? 'animate-spin' : ''} />
                                  <span className="hidden sm:inline">Delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <div 
                            className="text-slate-600 dark:text-slate-300 text-sm mb-4 line-clamp-3 prose prose-sm max-w-none pointer-events-none" 
                            dangerouslySetInnerHTML={{ __html: notice.content }} 
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400 font-medium pt-3 border-t border-slate-100 dark:border-slate-800/80">
                          <span>{new Date(notice.publish_date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          <span className="text-brand-600 dark:text-brand-400 font-semibold group-hover:underline flex items-center gap-1">
                            Read circular &rarr;
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-slate-50 dark:bg-slate-900/60 border-dashed border-slate-300 dark:border-slate-800 p-8 text-center">
                  <div className="max-w-md mx-auto flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                      <Bell size={22} />
                    </div>
                    <h4 className="font-bold text-base text-slate-800 dark:text-slate-200 mb-1">No Active Notices</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      There are no recent notices or circulars published for your role at this time. All new announcements will appear here.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Calendar Widget - Visible to all faculty and staff */}
      <CalendarWidget />

      {/* Core KPIs (Faculty & Academic Leadership Only) */}
      {isAcademicFaculty && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Core KPIs */}
        <Card hoverable className="border-t-4 border-t-brand-500 flex flex-col justify-between">
          <CardContent className="p-6 flex flex-col gap-4 h-full">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">My Classes</h3>
              <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <BookOpen size={20} />
              </div>
            </div>
            <div>
              <p className="text-4xl font-black text-brand-600 dark:text-brand-400 mb-1">{totalAssignedClasses}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Active classes assigned to you</p>
            </div>
          </CardContent>
        </Card>

        <Card hoverable className="border-t-4 border-t-amber-500 flex flex-col justify-between">
          <CardContent className="p-6 flex flex-col gap-4 h-full">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Pending Entries</h3>
              <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-500 dark:text-amber-400 flex items-center justify-center">
                <Clock size={20} />
              </div>
            </div>
            <div>
              <p className="text-4xl font-black text-amber-500 dark:text-amber-400 mb-1">{pendingEntries}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Marks requiring input this term</p>
            </div>
          </CardContent>
        </Card>

        {/* Class Attendance Overview Widget */}
        <Card hoverable className="border-t-4 border-t-emerald-500 flex flex-col">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Today's Attendance</h3>
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500 dark:text-emerald-400 flex items-center justify-center">
                <Users size={20} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Present</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg">{presentToday}</span>
              </div>
              <div className="flex justify-between items-center bg-red-50/50 dark:bg-red-950/30 p-3 rounded-lg border border-red-100 dark:border-red-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Absent</span>
                <span className="font-black text-red-600 dark:text-red-400 text-lg">{absentToday}</span>
              </div>
              <div className="flex justify-between items-center bg-purple-50/50 dark:bg-purple-950/30 p-3 rounded-lg border border-purple-100 dark:border-purple-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-200">On Leave</span>
                <span className="font-black text-purple-600 dark:text-purple-400 text-lg">{leaveToday}</span>
              </div>
              <div className="flex justify-between items-center bg-amber-50/50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-100 dark:border-amber-900/40 mt-2">
                <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5"><AlertCircle size={16}/> At Risk</span>
                <span className="font-black text-amber-600 dark:text-amber-400 text-lg">{studentsAtRisk}</span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
      )}

      {/* Absentees Collapsible Section (Teachers & Academic Staff Only) */}
      {isAcademicFaculty && (() => {
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

      {/* Quick Actions Bento Box */}
      <div className="pt-4">
         <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">Quick Actions</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            
            {/* Digital Staff ID Card for pure support staff */}
            {isPureSupportStaff && (
              <Card hoverable className="cursor-pointer group border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20" onClick={() => setIsIdModalOpen(true)}>
                 <CardContent className="p-5 flex items-center gap-4">
                   <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                     <IdCard size={28} />
                   </div>
                   <div>
                     <strong className="block text-lg font-bold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Digital Staff ID</strong>
                     <span className="text-sm text-slate-500 dark:text-slate-400">View & display your ID badge</span>
                   </div>
                 </CardContent>
              </Card>
            )}

            {isLibrarian && (
              <Card hoverable className="cursor-pointer group" onClick={() => window.location.href='/library'}>
                 <CardContent className="p-5 flex items-center gap-4">
                   <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <BookOpen size={28} />
                   </div>
                   <div>
                     <strong className="block text-lg font-semibold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Library Dashboard</strong>
                     <span className="text-sm text-slate-500 dark:text-slate-400">Manage catalog and circulation</span>
                   </div>
                 </CardContent>
              </Card>
            )}

            {isAccountant && (
              <Card hoverable className="cursor-pointer group" onClick={() => window.location.href='/fees'}>
                 <CardContent className="p-5 flex items-center gap-4">
                   <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <Building2 size={28} />
                   </div>
                   <div>
                     <strong className="block text-lg font-semibold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Fee Management</strong>
                     <span className="text-sm text-slate-500 dark:text-slate-400">Manage student fee records</span>
                   </div>
                 </CardContent>
              </Card>
            )}

            {/* Academic Faculty Only Quick Actions */}
            {isAcademicFaculty && (
              <>
                {classes.filter(c => c.class_teacher_id === profile?.id).map(c => (
                  <Card key={`ct-card-${c.id}`} hoverable className="cursor-pointer group border-brand-200 dark:border-brand-800/60 bg-brand-50 dark:bg-brand-950/40" onClick={() => window.location.href=`/class-teacher-portal/${c.id}`}>
                     <CardContent className="p-5 flex items-center gap-4">
                       <div className="w-14 h-14 rounded-2xl bg-white dark:bg-brand-900 text-brand-600 dark:text-brand-300 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                         <BookOpen size={28} />
                       </div>
                       <div>
                         <strong className="block text-lg font-bold text-brand-800 dark:text-brand-300 group-hover:text-brand-600 transition-colors">Class Teacher ({c.name} {c.section})</strong>
                         <span className="text-sm text-brand-600 dark:text-brand-400 font-medium">Manage your class</span>
                       </div>
                     </CardContent>
                  </Card>
                ))}

                <Card hoverable className="cursor-pointer group" onClick={() => window.location.href='/classes'}>
                   <CardContent className="p-5 flex items-center gap-4">
                     <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <Users size={28} />
                     </div>
                     <div>
                       <strong className="block text-lg font-semibold text-slate-800 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">Enter Marks</strong>
                       <span className="text-sm text-slate-500 dark:text-slate-400">Input marks for classes</span>
                     </div>
                   </CardContent>
                </Card>
                
                {isAdminOrHead && (
                  <Card hoverable className="cursor-pointer group" onClick={() => window.location.href='/coordinator/reports'}>
                     <CardContent className="p-5 flex items-center gap-4">
                       <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                         <Printer size={28} />
                       </div>
                       <div>
                         <strong className="block text-lg font-semibold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Reports</strong>
                         <span className="text-sm text-slate-500 dark:text-slate-400">Generate report cards</span>
                       </div>
                     </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Profile Photo Upload (Universal for all staff and teachers) */}
            <Card hoverable className="cursor-pointer group relative overflow-hidden">
               <CardContent className="p-5 flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Camera size={28} />
                 </div>
                 <div>
                   <strong className="block text-lg font-semibold text-slate-800 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Profile Photo</strong>
                   <span className="text-sm text-slate-500 dark:text-slate-400">Upload your picture</span>
                 </div>
                 <input 
                   type="file" 
                   accept="image/*" 
                   onChange={handleProfileUpload}
                   className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                 />
               </CardContent>
            </Card>
            
            {/* Python Portal (Faculty with rule access) */}
            {isAcademicFaculty && isPythonEnabled && (
              <Card hoverable className="cursor-pointer group border-brand-200 dark:border-slate-700 bg-gradient-to-br from-brand-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800" onClick={() => window.location.href='/python-teacher'}>
                 <CardContent className="p-5 flex items-center gap-4">
                   <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm text-2xl">
                     🐍
                   </div>
                   <div>
                     <strong className="block text-lg font-bold text-brand-800 dark:text-brand-300 group-hover:text-brand-600 transition-colors">Python Portal</strong>
                     <span className="text-sm text-brand-600 dark:text-brand-400 font-medium">Manage coding lessons</span>
                   </div>
                 </CardContent>
              </Card>
            )}
         </div>
      </div>
      
      {/* Student Absentee WhatsApp Alert Modal */}
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

      {/* Digital Staff ID Card Modal */}
      <DigitalStaffIDModal
        isOpen={isIdModalOpen}
        onClose={() => setIsIdModalOpen(false)}
        profile={profile}
      />

      {/* Notice Detail Reader Modal */}
      <NoticeDetailModal
        isOpen={!!selectedNoticeForModal}
        onClose={() => setSelectedNoticeForModal(null)}
        notice={selectedNoticeForModal}
        canDelete={isPrincipalOrAdmin}
        onDelete={(id) => handleDeleteNoticeFromDashboard(id, selectedNoticeForModal?.title)}
      />
    </motion.div>
  );
};

export default Dashboard;
