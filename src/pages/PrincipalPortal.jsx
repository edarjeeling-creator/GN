import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Search, Users, BookOpen, Bell, Send, Shield, User, Calendar, CheckCircle, XCircle, AlertTriangle, Printer, Clock, AlertCircle, FileText, ChevronDown, Settings, Upload, Phone, X } from 'lucide-react';
import Editor, { 
  Toolbar, BtnUndo, BtnRedo, BtnBold, BtnItalic, BtnUnderline, BtnStrikeThrough,
  BtnNumberedList, BtnBulletList, BtnLink, BtnClearFormatting, HtmlButton, Separator, BtnStyles
} from 'react-simple-wysiwyg';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StaffAttendance from '../components/StaffAttendance';
import AcademicReports from '../components/AcademicReports';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { absenteeNotificationService } from '../services/AbsenteeNotificationService';
import { formatStudentDisplayName } from '../utils/studentUtils';

const PrincipalPortal = () => {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [realtimeAlert, setRealtimeAlert] = useState(null);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [alertFilter, setAlertFilter] = useState('open');
  const [metrics, setMetrics] = useState({ students: 0, teachers: 0, assignments: 0 });
  const [recentNotices, setRecentNotices] = useState([]);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeAudience, setNoticeAudience] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [attendanceDateFilter, setAttendanceDateFilter] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [classesData, setClassesData] = useState([]);
  const [studentsData, setStudentsData] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [showAbsentees, setShowAbsentees] = useState(false);
  
  // Leadership Message Editor State
  const [leadershipMessage, setLeadershipMessage] = useState({ badge: 'LEADERSHIP', title: 'Message from the Principal', message: '', name: 'Dr. John Doe', imageUrl: '', btnText: 'Read Full Message', btnUrl: '/principal-desk' });
  const [leadershipFile, setLeadershipFile] = useState(null);
  const leadershipFileRef = React.useRef(null);
  const [savingLeadership, setSavingLeadership] = useState(false);


  useEffect(() => {
    fetchMetrics();
    fetchNotices();
    fetchClassesAndStudents();
  }, []);

  // Handle URL deep-links (e.g. /principal?tab=attendance)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
      if (tabParam === 'attendance') {
        setShowAbsentees(true);
      }
    }
  }, [searchParams]);

  // Real-time listener for incoming Absentee and emergency notifications
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase.channel(`principal_alerts_${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, (payload) => {
        if (payload.new?.type === 'attendance_absent') {
          setRealtimeAlert(payload.new);
          if (activeTab === 'attendance') {
            fetchAttendanceReports();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, activeTab]);

  useEffect(() => {
    if (activeTab === 'attendance') fetchAttendanceReports();
  }, [activeTab, attendanceDateFilter, customStartDate, customEndDate]);

  const handleFileSelect = (e) => setSelectedFile(e.target.files[0]);

  const handleSignatureUpload = async () => {
    if (!selectedFile) return;
    setUploadingSig(true);
    try {
      const base64String = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });
      const { error } = await supabase.rpc('upsert_school_setting', {
        p_key: 'principal_signature_url', p_value: base64String, p_desc: 'Digital Signature for Principal'
      });
      if (error) throw error;
      alert('Signature uploaded successfully!');
      setSelectedFile(null);
    } catch (err) {
      alert('Error uploading signature: ' + err.message);
    } finally {
      setUploadingSig(false);
    }
  };


  useEffect(() => {
    fetchLeadershipMessage();
  }, []);

  const fetchLeadershipMessage = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'leadership_message').single();
    if (data && data.value) setLeadershipMessage(JSON.parse(data.value));
  };

  const saveLeadershipMessage = async (e) => {
    if(e) e.preventDefault(); setSavingLeadership(true);
    try {
      let currentImageUrl = leadershipMessage.imageUrl;
      if (leadershipFile) {
        const fileExt = leadershipFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `leadership/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('public-assets').upload(filePath, leadershipFile, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('public-assets').getPublicUrl(filePath);
        
        if (currentImageUrl && currentImageUrl.includes('/public-assets/leadership/')) {
          const oldFilePath = currentImageUrl.split('/public-assets/')[1];
          if (oldFilePath) {
            await supabase.storage.from('public-assets').remove([oldFilePath]).catch(console.error);
          }
        }
        currentImageUrl = data.publicUrl;
      }
      
      const newMsg = { ...leadershipMessage, imageUrl: currentImageUrl };
      await supabase.from('site_settings').upsert({ key: 'leadership_message', value: JSON.stringify(newMsg) }, { onConflict: 'key,school_id' });
      setLeadershipMessage(newMsg);
      setLeadershipFile(null);
      if (leadershipFileRef.current) leadershipFileRef.current.value = '';
      alert("Leadership message saved successfully!");
    } catch (err) {
      alert("Error saving: " + err.message);
    } finally {
      setSavingLeadership(false);
    }
  };

  const fetchClassesAndStudents = async () => {
    const { data: cls } = await supabase.from('classes').select('*');
    if (cls) setClassesData(cls);
    const { data: std } = await supabase.from('students').select('id, name, roll_no, class_id, uid, picture_url, contact_number, father_name');
    if (std) setStudentsData(std);

    try {
      let query = supabase.from('system_alerts').select('*, students(name), classes(name, section)').order('created_at', { ascending: false });
      if (alertFilter === 'open') query = query.eq('status', 'open');
      if (alertFilter === 'resolved') query = query.eq('status', 'resolved');
      if (alertFilter === 'critical') query = query.eq('priority', 'critical');
      if (alertFilter === 'attendance') query = query.eq('category', 'attendance');
      const { data: alertsData, error: alertErr } = await query.limit(50);
      if (!alertErr && alertsData) setSystemAlerts(alertsData);
      else throw alertErr;
    } catch (e) {
      // Fallback query to notifications table (e.g. attendance_absent alerts)
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (notifs) {
        setSystemAlerts(notifs.map(n => ({
          id: n.id,
          title: n.title,
          description: n.message,
          priority: n.type === 'attendance_absent' ? 'critical' : 'normal',
          category: n.type === 'attendance_absent' ? 'attendance' : 'general',
          status: n.is_read ? 'resolved' : 'open',
          created_at: n.created_at
        })));
      }
    }
  };

  useEffect(() => {
    fetchClassesAndStudents();
  }, [alertFilter]);

  const fetchAttendanceReports = async () => {
    setLoadingAttendance(true);
    let startDate = new Date();
    let endDate = new Date();
    if (attendanceDateFilter === 'custom') {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
    } else {
      if (attendanceDateFilter === 'yesterday') { startDate.setDate(startDate.getDate() - 1); endDate.setDate(endDate.getDate() - 1); }
      else if (attendanceDateFilter === 'week') startDate.setDate(startDate.getDate() - 7);
      else if (attendanceDateFilter === 'month') startDate.setMonth(startDate.getMonth() - 1);
    }
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const { data } = await supabase.from('attendance').select('*').gte('date', startStr).lte('date', endStr);
    if (data) setAttendanceData(data);
    setLoadingAttendance(false);
  };

  const handleExportAttendanceCSV = () => {
    if (!attendanceData.length) return;
    const headers = [
      `"ATTENDANCE REPORT FOR GYANODAY NIKETAN"`,
      `"Export Date","${new Date().toLocaleDateString('en-GB')}"`,
      `"Date Range Filter Used","${attendanceDateFilter === 'custom' ? customStartDate + ' to ' + customEndDate : attendanceDateFilter}"`,
      `""`, `"Date","Admission Number","Student Name","Class","Attendance Status","Teacher Name","Submission Time"`
    ];
    const rows = attendanceData.map(a => {
      const student = studentsData.find(s => s.id === a.student_id);
      const cls = classesData.find(c => c.id === a.class_id);
      return `"${a.date}","${student?.uid || a.student_id}","${student?.name || 'Unknown'}","${cls ? cls.name + ' ' + cls.section : 'Unknown'}","${a.status}","${a.marked_by || 'System'}","${a.marked_at ? new Date(a.marked_at).toLocaleTimeString() : 'N/A'}"`;
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join('\n'), rows.join('\n')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_report_${attendanceDateFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchMetrics = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { count: stdCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
    const { count: tchCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['teacher', 'admin']);
    const { data: attData } = await supabase.from('attendance').select('status, class_id').eq('date', today);
    const { count: assCount } = await supabase.from('assignments').select('*', { count: 'exact', head: true });

    let attPercentage = 0;
    if (attData && attData.length > 0) {
      const presentCount = attData.filter(a => ['Present', 'Late', 'Half Day'].includes(a.status)).length;
      attPercentage = Math.round((presentCount / attData.length) * 100);
    }

    setMetrics({
      students: stdCount || 0,
      teachers: tchCount || 0,
      assignments: assCount || 0,
      attendancePercentage: attPercentage
    });
  };

  const fetchNotices = async () => {
    const { data } = await supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(5);
    if (data) setRecentNotices(data);
  };

  const handleSendNotice = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('notices').insert([{ sender_uid: user.id, title: noticeTitle, content: noticeMessage, target_audience: noticeAudience }]);
    if (!error) { setNoticeTitle(''); setNoticeMessage(''); fetchNotices(); alert('Notice sent successfully!'); }
    else alert('Failed to send notice');
  };

  const handleNotifyAbsentee = async (student, date) => {
    try {
      const cls = classesData.find(c => c.id === student.class_id);
      await absenteeNotificationService.notifyAbsentees({
        absentStudents: [student],
        className: cls ? `${cls.name} ${cls.section}` : 'General',
        classId: student.class_id,
        date,
        teacherName: profile?.name || "Principal's Office",
        teacherId: profile?.id,
        schoolId: profile?.school_id,
        isQR: false
      });
      alert(`Absence alert dispatched to ${formatStudentDisplayName(student.name)}'s parent portal!`);
    } catch (e) {
      console.error(e);
      alert(`Notification recorded for ${formatStudentDisplayName(student.name)}`);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setSearching(true);
    
    let combinedResults = [];

    // Search profiles (teachers/admins)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .ilike('name', `%${searchQuery}%`);
      
    // Fetch classes and subjects to determine class teacher or subjects taught
    const { data: allClasses } = await supabase.from('classes').select('name, section, class_teacher_id');
    const { data: allTeacherSubjects } = await supabase.from('teacher_subjects').select('teacher_id, subjects(name)');
      
    if (profileData) {
      combinedResults = [...combinedResults, ...profileData.map(p => {
        let classOrSub = p.subject || '-';
        if (p.role === 'teacher') {
           const classTaught = allClasses?.find(c => c.class_teacher_id === p.id);
           if (classTaught) {
             classOrSub = `Class Teacher (${classTaught.name} ${classTaught.section})`;
           } else {
             const subjects = allTeacherSubjects?.filter(ts => ts.teacher_id === p.id).map(ts => ts.subjects?.name).filter(Boolean);
             if (subjects && subjects.length > 0) {
               classOrSub = [...new Set(subjects)].join(', ');
             }
           }
        }
        return {
          ...p,
          subject: classOrSub,
          uid_display: p.id
        };
      })];
    }

    // Search students (by name or UID)
    const { data: studentData } = await supabase
      .from('students')
      .select('*, classes(name, section)')
      .or(`name.ilike.%${searchQuery}%,uid.ilike.%${searchQuery}%`);
      
    if (studentData) {
      combinedResults = [...combinedResults, ...studentData.map(s => ({
        id: s.id,
        name: s.name,
        role: 'student',
        class: s.classes?.name,
        section: s.classes?.section,
        uid_display: s.uid || s.id
      }))];
    }

    setSearchResults(combinedResults);
    setSearching(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6 print:space-y-0">
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Shield className="text-brand-600 dark:text-brand-400" size={32} /> {profile?.designation || 'Principal'} Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">School administration, oversight, and teaching management.</p>
        </div>
        <Link 
          to="/classes" 
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all self-start sm:self-auto"
        >
          <BookOpen size={18} /> My Teaching Classes & Subjects
        </Link>
      </div>

      {realtimeAlert && (
        <div className="bg-red-600 dark:bg-red-700 text-white p-4 rounded-xl shadow-lg flex items-center justify-between gap-4 border border-red-500/80 animate-fade-in no-print">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2.5 rounded-xl shrink-0">
              <AlertTriangle className="text-white" size={24} />
            </div>
            <div>
              <h4 className="font-black text-base text-white tracking-tight">{realtimeAlert.title}</h4>
              <p className="text-sm font-medium text-red-100 mt-0.5">{realtimeAlert.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button 
              size="sm" 
              variant="secondary" 
              className="bg-white text-red-700 hover:bg-red-50 font-bold border-none shadow-sm px-4"
              onClick={() => {
                setActiveTab('attendance');
                setShowAbsentees(true);
              }}
            >
              View Absentees
            </Button>
            <button 
              onClick={() => setRealtimeAlert(null)}
              className="p-2 hover:bg-white/20 rounded-lg text-white transition-colors"
              title="Dismiss alert"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="flex overflow-x-auto custom-scrollbar border-b border-slate-200 dark:border-slate-800 hide-scrollbar pb-2 no-print">
        <div className="flex gap-2 sm:gap-6 min-w-max">
          {(() => {
            const isPrincipal = !profile?.designation || profile?.designation === 'Principal';
            return [
              { id: 'overview', label: 'Overview' },
              { id: 'staff_attendance', label: 'Staff Attendance' },
              { id: 'attendance', label: 'Attendance Reports' },
              { id: 'academic_reports', label: 'Academic Reports' },
              { id: 'search', label: 'User Search' },
              { id: 'notices', label: 'Notices & Announcements' },
              ...(isPrincipal ? [{ id: 'leadership_message', label: 'Leadership Message' }] : []),
              { id: 'settings', label: 'Settings' }
            ];
          })().map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-3 px-1 text-sm sm:text-base font-semibold transition-colors ${activeTab === tab.id ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              {tab.label}
              {activeTab === tab.id && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 dark:bg-brand-400" />}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        
        {activeTab === 'staff_attendance' && (
          <motion.div key="staff_attendance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StaffAttendance />
          </motion.div>
        )}

        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Teaching Assignments Quick Action */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-blue-950/30 border border-blue-200 dark:border-blue-900/40 shadow-sm">
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-md shrink-0">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Teaching Classes & Subject Selection</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                      Teaching a class (such as Class 5)? Open <strong>My Classes</strong> to select subjects, enter marks, mark attendance, and manage student flowsheets.
                    </p>
                  </div>
                </div>
                <Link
                  to="/classes"
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all whitespace-nowrap text-center shrink-0"
                >
                  Manage My Classes & Subjects →
                </Link>
              </CardContent>
            </Card>

            <div>
              <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="text-brand-500" /> Operational Dashboard
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-t-4 border-t-brand-500 text-center flex flex-col justify-center bg-white dark:bg-slate-900">
                  <CardContent className="p-6">
                    <p className="text-brand-600/80 dark:text-brand-400 text-xs font-bold uppercase tracking-wider mb-2">Today's Attendance</p>
                    <h2 className="text-4xl font-black text-brand-600 dark:text-brand-400">{metrics.attPerc}%</h2>
                  </CardContent>
                </Card>
                <Card className="border-t-4 border-t-emerald-500 text-center flex flex-col justify-center bg-white dark:bg-slate-900">
                  <CardContent className="p-6">
                    <p className="text-emerald-600/80 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">Present</p>
                    <h2 className="text-4xl font-black text-emerald-600 dark:text-emerald-400">{metrics.presentCount}</h2>
                  </CardContent>
                </Card>
                <Card className="border-t-4 border-t-red-500 text-center flex flex-col justify-center bg-white dark:bg-slate-900">
                  <CardContent className="p-6">
                    <p className="text-red-600/80 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-2">Absent</p>
                    <h2 className="text-4xl font-black text-red-600 dark:text-red-400">{metrics.absentCount}</h2>
                  </CardContent>
                </Card>
                <Card className="border-t-4 border-t-purple-500 text-center flex flex-col justify-center bg-white dark:bg-slate-900">
                  <CardContent className="p-6">
                    <p className="text-purple-600/80 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">Medical Leave</p>
                    <h2 className="text-4xl font-black text-purple-600 dark:text-purple-400">{metrics.medLeaveCount}</h2>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 shadow-sm">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="bg-amber-100 dark:bg-amber-900/60 p-4 rounded-2xl text-amber-600 dark:text-amber-300 shrink-0"><Clock size={28} /></div>
                  <div>
                    <p className="text-amber-800 dark:text-amber-300 text-sm font-bold uppercase tracking-wider">Pending Classes</p>
                    <h2 className="text-3xl font-black text-amber-600 dark:text-amber-400">{metrics.pendingClasses}</h2>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 shadow-sm">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-2xl text-slate-600 dark:text-slate-300 shrink-0"><AlertCircle size={28} /></div>
                  <div>
                    <p className="text-slate-700 dark:text-slate-300 text-sm font-bold uppercase tracking-wider">Open Alerts</p>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">{metrics.openAlerts}</h2>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 shadow-sm">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="bg-red-100 dark:bg-red-900/60 p-4 rounded-2xl text-red-600 dark:text-red-300 shrink-0"><AlertTriangle size={28} /></div>
                  <div>
                    <p className="text-red-800 dark:text-red-300 text-sm font-bold uppercase tracking-wider">Critical Alerts</p>
                    <h2 className="text-3xl font-black text-red-600 dark:text-red-400">{metrics.criticalAlerts || 0}</h2>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 p-5">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white text-lg font-bold">
                    <AlertTriangle className="text-amber-500 shrink-0" size={22} /> System Alerts & Anomalies
                  </CardTitle>
                  <div className="flex gap-1 bg-slate-200/80 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-300/60 dark:border-slate-700">
                    {['all', 'open', 'critical', 'attendance', 'resolved'].map(filter => (
                      <button
                        key={filter}
                        onClick={() => setAlertFilter(filter)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                          alertFilter === filter 
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                      <tr>
                        <th className="p-4">Alert Details</th>
                        <th className="p-4">Priority</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Time</th>
                        <th className="p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                      {systemAlerts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">
                            No alerts matching filter.
                          </td>
                        </tr>
                      ) : (
                        systemAlerts.map(alert => {
                          const isAbsenceAlert = alert.title?.includes('Absence Alert') || alert.category === 'attendance' || alert.category === 'Attendance';
                          const isCritical = alert.priority === 'critical' || isAbsenceAlert;

                          return (
                            <tr 
                              key={alert.id} 
                              className={`transition-colors ${
                                isCritical 
                                  ? 'bg-red-50/80 hover:bg-red-100/70 dark:bg-red-950/40 dark:hover:bg-red-950/60 border-l-4 border-l-red-500' 
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <td className="p-4">
                                <div className="flex items-start gap-3">
                                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 shadow-sm ${
                                    isCritical 
                                      ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-200 dark:border-red-500/30' 
                                      : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                                  }`}>
                                    <AlertTriangle size={18} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-bold text-slate-900 dark:text-white text-base tracking-tight leading-snug">
                                        {alert.title}
                                      </p>
                                      {isAbsenceAlert && (
                                        <button 
                                          onClick={() => { setActiveTab('attendance'); setShowAbsentees(true); }}
                                          className="text-xs font-bold text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 bg-red-100 dark:bg-red-900/60 px-2 py-0.5 rounded transition-colors inline-flex items-center gap-1"
                                        >
                                          View Absentees →
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">
                                      {alert.description}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 align-middle">
                                <Badge 
                                  variant={isCritical ? 'danger' : 'warning'} 
                                  className={`font-bold uppercase tracking-wider text-xs px-3 py-1 ${
                                    isCritical 
                                      ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/70 dark:text-red-200 dark:border-red-700' 
                                      : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/70 dark:text-amber-200 dark:border-amber-700'
                                  }`}
                                >
                                  {alert.priority}
                                </Badge>
                              </td>
                              <td className="p-4 align-middle capitalize text-slate-800 dark:text-slate-200 font-semibold">
                                {alert.category}
                              </td>
                              <td className="p-4 align-middle text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="p-4 align-middle">
                                <Badge 
                                  variant={alert.status === 'open' ? 'danger' : 'success'} 
                                  className={`font-bold uppercase tracking-wider text-xs px-3 py-1 ${
                                    alert.status === 'open' 
                                      ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/70 dark:text-red-200 dark:border-red-700' 
                                      : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/70 dark:text-emerald-200 dark:border-emerald-700'
                                  }`}
                                >
                                  {alert.status}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'attendance' && (
          <motion.div key="attendance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <Card className="p-4">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex gap-2 items-center flex-wrap">
                  <select className="h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer" value={attendanceDateFilter} onChange={e => setAttendanceDateFilter(e.target.value)}>
                    <option value="today" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Today</option>
                    <option value="yesterday" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Yesterday</option>
                    <option value="week" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">This Week</option>
                    <option value="month" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">This Month</option>
                    <option value="custom" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Custom Range</option>
                  </select>
                  {attendanceDateFilter === 'custom' && (
                    <div className="flex items-center gap-2">
                      <Input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-auto h-10" />
                      <span className="text-slate-500">to</span>
                      <Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-auto h-10" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleExportAttendanceCSV}><FileText size={16} className="mr-2" /> Export CSV</Button>
                  <Button variant="outline" onClick={() => window.print()}><Printer size={16} className="mr-2" /> Print</Button>
                </div>
              </div>
            </Card>

            {loadingAttendance ? (
              <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
              <>
                {(() => {
                  const total = attendanceData.length;
                  const pres = attendanceData.filter(a => ['Present', 'Late', 'Half Day'].includes(a.status)).length;
                  const abs = attendanceData.filter(a => ['Absent', 'Leave'].includes(a.status)).length;
                  const perc = total > 0 ? ((pres / total) * 100).toFixed(1) : 0;
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="border-l-4 border-l-brand-500 bg-slate-50 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800"><CardContent className="p-4 flex items-center gap-4"><div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-brand-600 dark:text-brand-400"><Users size={24}/></div><div><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Records</p><h3 className="text-2xl font-black text-slate-900 dark:text-white">{total}</h3></div></CardContent></Card>
                      <Card className="border-l-4 border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60"><CardContent className="p-4 flex items-center gap-4"><div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-emerald-600 dark:text-emerald-400"><CheckCircle size={24}/></div><div><p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Present</p><h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{pres}</h3></div></CardContent></Card>
                      <Card className="border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/60"><CardContent className="p-4 flex items-center gap-4"><div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-red-600 dark:text-red-400"><XCircle size={24}/></div><div><p className="text-xs font-bold text-red-800 dark:text-red-300 uppercase tracking-wider">Absent</p><h3 className="text-2xl font-black text-red-700 dark:text-red-400">{abs}</h3></div></CardContent></Card>
                      <Card className="border-l-4 border-l-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60"><CardContent className="p-4 flex items-center gap-4"><div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-indigo-600 dark:text-indigo-400"><Calendar size={24}/></div><div><p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">Attendance %</p><h3 className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{perc}%</h3></div></CardContent></Card>
                    </div>
                  );
                })()}

                {(() => {
                  const absentees = attendanceData.filter(a => ['Absent', 'Leave'].includes(a.status));
                  if (!absentees.length) return null;
                  return (
                    <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                      <button className="w-full bg-white dark:bg-slate-900 p-4 flex justify-between items-center text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors focus:outline-none" onClick={() => setShowAbsentees(!showAbsentees)}>
                        <div className="flex items-center gap-4">
                          <div className="bg-red-100 dark:bg-red-900/60 p-2.5 rounded-full"><AlertTriangle className="text-red-600 dark:text-red-300" size={20} /></div>
                          <div><h3 className="font-bold text-lg text-slate-900 dark:text-white">Absent Students List</h3><p className="text-sm text-slate-500 dark:text-slate-400">View details and privately notify ({absentees.length} records)</p></div>
                        </div>
                        <ChevronDown size={24} className={`text-slate-400 transition-transform ${showAbsentees ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {showAbsentees && (
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {absentees.map(a => {
                                  const student = studentsData.find(s => s.id === a.student_id);
                                  const cls = classesData.find(c => c.id === a.class_id);
                                  if (!student) return null;
                                  return (
                                    <Card key={a.id} className="flex flex-col justify-between hover:shadow-md transition-shadow bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                      <CardContent className="p-4">
                                        <div className="flex items-start gap-4 mb-3">
                                          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                            {student.picture_url ? <img src={student.picture_url} className="w-full h-full object-cover" /> : <User size={24} className="text-slate-400" />}
                                          </div>
                                          <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white leading-tight text-base">{formatStudentDisplayName(student.name)}</h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">{cls ? `${cls.name} ${cls.section}` : ''} • Roll No. {student.roll_no || 'N/A'}</p>
                                            <Badge variant="danger" className="font-bold text-xs uppercase px-2 py-0.5">{a.status}</Badge>
                                          </div>
                                        </div>

                                        {student.father_name && (
                                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                            Guardian: <span className="font-semibold text-slate-700 dark:text-slate-200">{student.father_name}</span>
                                          </p>
                                        )}

                                        <div className="mt-3 flex flex-col gap-2">
                                          {student.contact_number ? (
                                            <a 
                                              href={absenteeNotificationService.generateParentWhatsAppUrl(student, cls ? `${cls.name} ${cls.section}` : '', a.date)}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                            >
                                              <Phone size={14} /> WhatsApp Parent ({student.contact_number})
                                            </a>
                                          ) : (
                                            <div className="text-[11px] text-slate-400 dark:text-slate-400 italic text-center py-1 bg-slate-100 dark:bg-slate-800 rounded">
                                              No parent phone registered
                                            </div>
                                          )}
                                          <Button onClick={() => handleNotifyAbsentee(student, a.date)} className="w-full text-xs font-semibold" size="sm" variant="outline">
                                            <Send size={13} className="mr-1.5"/> Send Portal Alert
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="flex flex-col h-full max-h-[500px]">
                    <CardHeader className="border-b border-slate-100"><CardTitle>Class-wise Breakdown</CardTitle></CardHeader>
                    <CardContent className="p-0 overflow-auto flex-1 custom-scrollbar">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                          <tr><th className="p-3 font-semibold text-slate-600">Class</th><th className="p-3 font-semibold text-slate-600">Present</th><th className="p-3 font-semibold text-slate-600">Absent</th><th className="p-3 font-semibold text-slate-600">%</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {classesData.map(cls => {
                            const classAtt = attendanceData.filter(a => a.class_id === cls.id);
                            if (!classAtt.length) return null;
                            const pres = classAtt.filter(a => ['Present', 'Late'].includes(a.status)).length;
                            const abs = classAtt.filter(a => ['Absent', 'Leave'].includes(a.status)).length;
                            const perc = ((pres / classAtt.length) * 100).toFixed(1);
                            return (
                              <tr key={cls.id} className="hover:bg-slate-50">
                                <td className="p-3 font-medium text-slate-800">{cls.name} {cls.section}</td>
                                <td className="p-3 font-bold text-emerald-600">{pres}</td>
                                <td className="p-3 font-bold text-red-600">{abs}</td>
                                <td className="p-3 font-bold text-slate-700">{perc}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                  
                  <Card className="flex flex-col h-full max-h-[500px]">
                    <CardHeader className="border-b border-slate-100 flex items-center gap-2 text-amber-600"><AlertTriangle size={18} /><CardTitle className="text-amber-700">Frequently Absent</CardTitle></CardHeader>
                    <CardContent className="p-0 overflow-auto flex-1 custom-scrollbar">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                          <tr><th className="p-3 font-semibold text-slate-600">Student</th><th className="p-3 font-semibold text-slate-600">Class</th><th className="p-3 font-semibold text-slate-600">Absences</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(() => {
                            const absentsMap = {};
                            attendanceData.forEach(a => { if (['Absent', 'Leave'].includes(a.status)) absentsMap[a.student_id] = (absentsMap[a.student_id] || 0) + 1; });
                            const sorted = Object.entries(absentsMap).sort((a,b) => b[1]-a[1]).slice(0,10);
                            if (!sorted.length) return <tr><td colSpan="3" className="p-6 text-center text-slate-500">No absentees found.</td></tr>;
                            return sorted.map(([id, count]) => {
                              const s = studentsData.find(x => x.id === id); const c = classesData.find(x => x.id === s?.class_id);
                              return (
                                <tr key={id} className="hover:bg-slate-50">
                                  <td className="p-3 font-medium text-slate-800">{s?.name}</td>
                                  <td className="p-3 text-slate-600 text-sm">{c ? `${c.name} ${c.section}` : '-'}</td>
                                  <td className="p-3 font-bold text-red-600">{count} days</td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader><CardTitle>Attendance Trend</CardTitle></CardHeader>
                  <CardContent className="h-[300px]">
                    {(() => {
                      const tMap = {};
                      attendanceData.forEach(a => {
                        if (!tMap[a.date]) tMap[a.date] = { date: a.date, Present: 0, Absent: 0 };
                        if (['Present', 'Late', 'Half Day'].includes(a.status)) tMap[a.date].Present++;
                        else if (['Absent', 'Leave'].includes(a.status)) tMap[a.date].Absent++;
                      });
                      const tData = Object.values(tMap).sort((a,b) => new Date(a.date) - new Date(b.date));
                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={tData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748B'}} tickFormatter={str => new Date(str).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} />
                            <YAxis tick={{fontSize: 12, fill: '#64748B'}} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Line type="monotone" dataKey="Present" stroke="#10B981" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                            <Line type="monotone" dataKey="Absent" stroke="#EF4444" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                          </LineChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </CardContent>
                </Card>
              </>
            )}
          </motion.div>
        )}

        {activeTab === 'academic_reports' && (
          <motion.div key="academic_reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AcademicReports />
          </motion.div>
        )}

        {activeTab === 'search' && (
          <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card>
              <CardHeader><CardTitle>Global User Search</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 mb-6">
                  <Input type="text" placeholder="Search by Name or UID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1 h-12 text-lg" />
                  <Button type="submit" disabled={searching} className="h-12 px-8">{searching ? 'Searching...' : 'Search'}</Button>
                </form>
                {searchResults.length > 0 && (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left divide-y divide-slate-200 dark:divide-slate-800">
                      <thead className="bg-slate-50 dark:bg-slate-800/80"><tr><th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Name</th><th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Role</th><th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Class/Sub</th><th className="p-4 font-semibold text-slate-600 dark:text-slate-300">UID</th></tr></thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {searchResults.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-4 font-semibold text-slate-800 dark:text-white">{u.role === 'student' ? formatStudentDisplayName(u.name) : u.name}</td>
                            <td className="p-4"><Badge variant="secondary" className="uppercase">{u.role}</Badge></td>
                            <td className="p-4 text-slate-600 dark:text-slate-300">{u.class ? `${u.class} ${u.section || ''}` : (u.subject || '-')}</td>
                            <td className="p-4 text-slate-400 font-mono text-sm">{u.uid_display || u.id}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'notices' && (
          <motion.div key="notices" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white"><Send size={20} className="text-brand-500" /> Create Notice</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSendNotice} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Notice Title</label>
                    <Input required type="text" value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} placeholder="E.g. Tomorrow is a holiday" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Message</label>
                    <div className="border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500">
                      <Editor value={noticeMessage} onChange={e => setNoticeMessage(e.target.value)} style={{ minHeight: '200px' }}>
                        <Toolbar>
                          <BtnUndo /><BtnRedo /><Separator /><BtnBold /><BtnItalic /><BtnUnderline /><BtnStrikeThrough /><Separator /><BtnNumberedList /><BtnBulletList /><Separator /><BtnLink /><BtnClearFormatting />
                        </Toolbar>
                      </Editor>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Target Audience</label>
                    <select 
                      className="input-field w-full h-11 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 cursor-pointer" 
                      value={noticeAudience} 
                      onChange={e => setNoticeAudience(e.target.value)}
                    >
                      <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Entire School</option>
                      <option value="students" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Only Students</option>
                      <option value="teachers" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Only Teachers</option>
                    </select>
                  </div>
                  <Button type="submit" className="w-full h-12 mt-2 shadow-lg shadow-brand-500/20">Publish Notice</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white"><Bell size={20} className="text-brand-500" /> Recent Notices</CardTitle></CardHeader>
              <CardContent>
                {recentNotices.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">No recent notices published.</div>
                ) : (
                  <div className="space-y-4">
                    {recentNotices.map(n => (
                      <div key={n.id} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <h3 className="font-bold text-slate-800 dark:text-white text-lg leading-tight">{n.title}</h3>
                          <Badge variant="secondary" className="uppercase text-[10px] whitespace-nowrap tracking-wider">{n.target_audience}</Badge>
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 text-sm mb-3 prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: n.content }} />
                        <p className="text-xs font-semibold text-slate-400">{new Date(n.publish_date).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}


        {activeTab === 'leadership_message' && (
          <motion.div key="leadership_message" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><User size={20} className="text-brand-500" /> Leadership Message Editor</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={saveLeadershipMessage} style={{ display: 'grid', gap: '1rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Badge: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.badge} onChange={e => setLeadershipMessage({...leadershipMessage, badge: e.target.value})} /></label>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.title} onChange={e => setLeadershipMessage({...leadershipMessage, title: e.target.value})} /></label>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Message: <textarea className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.message} onChange={e => setLeadershipMessage({...leadershipMessage, message: e.target.value})} rows="4" /></label>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Name: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.name} onChange={e => setLeadershipMessage({...leadershipMessage, name: e.target.value})} /></label>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Photo Badge Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.photoBadgeTitle || "Principal's Photo"} onChange={e => setLeadershipMessage({...leadershipMessage, photoBadgeTitle: e.target.value})} /></label>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Photo Badge Subtitle: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.photoBadgeSubtitle || "A Tradition of Excellence"} onChange={e => setLeadershipMessage({...leadershipMessage, photoBadgeSubtitle: e.target.value})} /></label>
                  
                  <div style={{ padding: '1rem', background: '#f1f5f9', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Principal Photo</label>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      {(leadershipFile || leadershipMessage.imageUrl) && (
                        <img 
                          src={leadershipFile ? URL.createObjectURL(leadershipFile) : leadershipMessage.imageUrl} 
                          alt="Preview" 
                          style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '0.5rem', border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} 
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <input 
                          type="file" 
                          accept=".jpg,.jpeg,.png,.webp"
                          ref={leadershipFileRef}
                          onChange={e => {
                            const file = e.target.files[0];
                            if (file && file.size > 5 * 1024 * 1024) {
                              alert('File size exceeds 5MB limit.');
                              e.target.value = '';
                              return;
                            }
                            setLeadershipFile(file || null);
                          }}
                          style={{ width: '100%', padding: '0.5rem', background: '#fff', border: '1px border #cbd5e1', borderRadius: '0.25rem' }} 
                        />
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>JPG, PNG, WebP up to 5MB. {(leadershipMessage.imageUrl && !leadershipFile) && "Upload a new file to replace the existing image."}</p>
                        
                        {leadershipMessage.imageUrl && !leadershipFile && (
                          <button 
                            type="button" 
                            onClick={() => {
                              if(confirm('Are you sure you want to remove the current image?')) {
                                 setLeadershipMessage({...leadershipMessage, imageUrl: ''});
                              }
                            }}
                            style={{ marginTop: '0.5rem', background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Remove Existing Image
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button Text: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.btnText} onChange={e => setLeadershipMessage({...leadershipMessage, btnText: e.target.value})} /></label>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button URL: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.btnUrl} onChange={e => setLeadershipMessage({...leadershipMessage, btnUrl: e.target.value})} /></label>
                  
                  <Button type="submit" disabled={savingLeadership} className="w-full mt-4 h-12 shadow-lg shadow-brand-500/20 text-white font-bold bg-brand-600 hover:bg-brand-700">
                    {savingLeadership ? 'Saving...' : 'Save Leadership Message'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="max-w-2xl">
              <CardHeader><CardTitle className="flex items-center gap-2"><Settings size={20} className="text-brand-500" /> School Settings & Branding</CardTitle></CardHeader>
              <CardContent>
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Principal Digital Signature</h3>
                  <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                    Upload the official digital signature. This signature will automatically be printed on all student Report Cards. For best results, use a PNG image with a transparent background.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <Input type="file" accept="image/png, image/jpeg, image/jpg" onChange={handleFileSelect} disabled={uploadingSig} className="bg-white flex-1 cursor-pointer" />
                    {selectedFile && (
                      <Button onClick={handleSignatureUpload} disabled={uploadingSig} className="shrink-0">
                        <Upload size={18} className="mr-2" /> {uploadingSig ? 'Uploading...' : 'Save Signature'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PrincipalPortal;
