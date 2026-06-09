import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Users, BookOpen, Bell, Send, Shield, User, Calendar, CheckCircle, XCircle, AlertTriangle, Printer, Clock, AlertCircle, FileText, ChevronDown, Settings, Upload } from 'lucide-react';
import Editor, { 
  Toolbar,
  BtnUndo, BtnRedo, BtnBold, BtnItalic, BtnUnderline, BtnStrikeThrough,
  BtnNumberedList, BtnBulletList, BtnLink, BtnClearFormatting, HtmlButton, Separator,
  BtnStyles
} from 'react-simple-wysiwyg';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import StaffAttendance from '../components/StaffAttendance';

const PrincipalPortal = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [uploadingSig, setUploadingSig] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const handleFileSelect = (e) => {
    setSelectedFile(e.target.files[0]);
  };

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

      const { error } = await supabase.from('school_settings').upsert({
        setting_key: 'principal_signature_url',
        setting_value: base64String,
        description: 'Digital Signature for Principal'
      }, { onConflict: 'setting_key' });
      
      if (error) throw error;
      
      alert('Signature uploaded successfully! It will now appear on all Report Cards.');
      setSelectedFile(null);
    } catch (err) {
      console.error("Signature upload error:", err);
      alert('Error uploading signature: ' + err.message);
    } finally {
      setUploadingSig(false);
    }
  };
  
  // System Alerts State
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [alertFilter, setAlertFilter] = useState('open'); // 'all', 'open', 'resolved', 'critical', 'attendance'
  
  // Dashboard state
  const [metrics, setMetrics] = useState({ students: 0, teachers: 0, assignments: 0 });
  const [recentNotices, setRecentNotices] = useState([]);
  
  // Notice state
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeAudience, setNoticeAudience] = useState('all');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Attendance Reports State
  const [attendanceDateFilter, setAttendanceDateFilter] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [classesData, setClassesData] = useState([]);
  const [studentsData, setStudentsData] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [showAbsentees, setShowAbsentees] = useState(false);

  useEffect(() => {
    fetchMetrics();
    fetchNotices();
    fetchClassesAndStudents();
  }, []);

  useEffect(() => {
    if (activeTab === 'attendance') {
      fetchAttendanceReports();
    }
  }, [activeTab, attendanceDateFilter, customStartDate, customEndDate]);

  const fetchClassesAndStudents = async () => {
    const { data: cls } = await supabase.from('classes').select('*');
    if (cls) setClassesData(cls);
    const { data: std } = await supabase.from('students').select('id, name, roll_no, class_id, uid, picture_url');
    if (std) setStudentsData(std);

    // Fetch System Alerts
    let query = supabase
      .from('system_alerts')
      .select('*, students(name), classes(name, section)')
      .order('created_at', { ascending: false });

    if (alertFilter === 'open') query = query.eq('status', 'open');
    if (alertFilter === 'resolved') query = query.eq('status', 'resolved');
    if (alertFilter === 'critical') query = query.eq('priority', 'critical');
    if (alertFilter === 'attendance') query = query.eq('category', 'attendance');

    const { data: alertsData } = await query.limit(50);
    if (alertsData) setSystemAlerts(alertsData);
  };

  useEffect(() => {
    fetchClassesAndStudents();
  }, [alertFilter]);

  const fetchAttendanceReports = async () => {
    setLoadingAttendance(true);
    let startStr = '';
    let endStr = '';

    if (attendanceDateFilter === 'custom') {
      startStr = customStartDate;
      endStr = customEndDate;
    } else {
      let startDate = new Date();
      let endDate = new Date();
      if (attendanceDateFilter === 'today') {
        // start and end are today
      } else if (attendanceDateFilter === 'yesterday') {
        startDate.setDate(startDate.getDate() - 1);
        endDate.setDate(endDate.getDate() - 1);
      } else if (attendanceDateFilter === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (attendanceDateFilter === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      }
      startStr = startDate.toISOString().split('T')[0];
      endStr = endDate.toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', startStr)
      .lte('date', endStr);
      
    if (data) setAttendanceData(data);
    setLoadingAttendance(false);
  };

  const exportCSV = async () => {
    if (!attendanceData.length) return;
    
    // Fetch all teachers to match marked_by
    const { data: teachers } = await supabase.from('profiles').select('id, name').eq('role', 'teacher');
    
    // Build Metadata Block
    const metadata = [
      `"School Name","Gyanoday Niketan"`,
      `"Report Generated By","Principal"`,
      `"Generated Timestamp","${new Date().toLocaleString()}"`,
      `"Date Range Filter Used","${attendanceDateFilter === 'custom' ? customStartDate + ' to ' + customEndDate : attendanceDateFilter}"`,
      `""`, // Blank line
      `"Date","Admission Number","Student Name","Class","Attendance Status","Teacher Name","Submission Time"`
    ];

    const rows = attendanceData.map(a => {
      const student = studentsData.find(s => s.id === a.student_id);
      const cls = classesData.find(c => c.id === a.class_id);
      const teacher = teachers?.find(t => t.id === a.marked_by);
      
      const submissionTime = a.marked_at ? new Date(a.marked_at).toLocaleTimeString() : 'N/A';
      
      return [
        a.date,
        student ? student.uid : 'Unknown',
        student ? student.name : 'Unknown',
        cls ? `${cls.name} ${cls.section}` : 'Unknown',
        a.status,
        teacher ? teacher.name : 'System/Unknown',
        submissionTime
      ].map(field => `"${field}"`).join(',');
    });
    
    const csvContent = [...metadata, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `attendance_report_${attendanceDateFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchMetrics = async () => {
    const today = new Date().toISOString().split('T')[0];

    // 1. Basic Stats
    const { count: studentCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
    const { count: teacherCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher');
    
    // 2. Today's Attendance
    const { data: attData } = await supabase.from('attendance').select('status, class_id').eq('date', today);
    const presentCount = attData?.filter(a => ['Present', 'Late', 'Half Day'].includes(a.status)).length || 0;
    const absentCount = attData?.filter(a => a.status === 'Absent').length || 0;
    const medLeaveCount = attData?.filter(a => a.status === 'Medical Leave').length || 0;
    const leaveCount = attData?.filter(a => a.status === 'Leave').length || 0;
    
    // Calc %
    const denominator = presentCount + absentCount; // Exclude Leave and Medical Leave
    const attPerc = denominator > 0 ? ((presentCount / denominator) * 100).toFixed(1) : 0;
    
    // 3. Pending Classes
    const submittedClassIds = new Set(attData?.map(a => a.class_id) || []);
    const { count: totalClasses } = await supabase.from('classes').select('*', { count: 'exact', head: true });
    const pendingClasses = (totalClasses || 0) - submittedClassIds.size;

    // 4. Alerts
    const { count: openAlerts } = await supabase.from('system_alerts').select('*', { count: 'exact', head: true }).eq('status', 'open');
    const { count: criticalAlerts } = await supabase.from('system_alerts').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('priority', 'critical');
    
    setMetrics({
      students: studentCount || 0,
      teachers: teacherCount || 0,
      attPerc,
      presentCount,
      absentCount,
      medLeaveCount,
      pendingClasses,
      openAlerts: openAlerts || 0,
      criticalAlerts: criticalAlerts || 0
    });
  };

  const fetchNotices = async () => {
    const { data } = await supabase.from('notices').select('*').order('publish_date', { ascending: false }).limit(5);
    if (data) setRecentNotices(data);
  };

  const handleSendNotice = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('notices').insert([{
      sender_uid: user.id,
      title: noticeTitle,
      message: noticeMessage,
      audience: noticeAudience
    }]);

    if (!error) {
      setNoticeTitle('');
      setNoticeMessage('');
      fetchNotices();
      alert('Notice sent successfully!');
    } else {
      alert('Failed to send notice: ' + error.message);
    }
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

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setSearching(true);
    
    // Search profiles by name or UID
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`name.ilike.%${searchQuery}%,id.eq.${searchQuery}`);

    if (data) setSearchResults(data);
    setSearching(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-8">
        <Shield size={32} className="text-primary" />
        <h1 className="text-2xl font-bold">Principal Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b pb-2 overflow-x-auto">
        <button onClick={() => setActiveTab('overview')} className={`font-bold pb-2 whitespace-nowrap ${activeTab === 'overview' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>Overview</button>
        <button onClick={() => setActiveTab('staff_attendance')} className={`font-bold pb-2 whitespace-nowrap ${activeTab === 'staff_attendance' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>Staff Attendance</button>
        <button onClick={() => setActiveTab('attendance')} className={`font-bold pb-2 whitespace-nowrap ${activeTab === 'attendance' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>Attendance Reports</button>
        <button onClick={() => setActiveTab('search')} className={`font-bold pb-2 whitespace-nowrap ${activeTab === 'search' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>User Search</button>
        <button onClick={() => setActiveTab('notices')} className={`font-bold pb-2 whitespace-nowrap ${activeTab === 'notices' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>Notices & Announcements</button>
        <button onClick={() => setActiveTab('settings')} className={`font-bold pb-2 whitespace-nowrap ${activeTab === 'settings' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>Settings</button>
      </div>

      {/* Staff Attendance Tab */}
      {activeTab === 'staff_attendance' && (
        <div className="mb-6">
          <StaffAttendance />
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Shield className="text-slate-500" /> Operational Dashboard</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4 bg-white shadow-sm border-t-4 border-blue-500 flex flex-col justify-center items-center">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Today's Attendance</p>
                <h2 className="text-3xl font-black text-blue-600">{metrics.attPerc}%</h2>
              </div>
              <div className="card p-4 bg-white shadow-sm border-t-4 border-green-500 flex flex-col justify-center items-center">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Present</p>
                <h2 className="text-3xl font-black text-green-600">{metrics.presentCount}</h2>
              </div>
              <div className="card p-4 bg-white shadow-sm border-t-4 border-red-500 flex flex-col justify-center items-center">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Absent</p>
                <h2 className="text-3xl font-black text-red-600">{metrics.absentCount}</h2>
              </div>
              <div className="card p-4 bg-white shadow-sm border-t-4 border-purple-500 flex flex-col justify-center items-center">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Medical Leave</p>
                <h2 className="text-3xl font-black text-purple-600">{metrics.medLeaveCount}</h2>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="card p-6 bg-white shadow-sm border border-amber-200 bg-amber-50 flex items-center gap-4">
              <div className="bg-amber-100 p-4 rounded-full text-amber-600"><Clock size={24} /></div>
              <div>
                <p className="text-amber-800 text-sm font-bold uppercase">Pending Classes</p>
                <h2 className="text-3xl font-black text-amber-600">{metrics.pendingClasses}</h2>
              </div>
            </div>
            <div className="card p-6 bg-white shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="bg-slate-100 p-4 rounded-full text-slate-600"><AlertCircle size={24} /></div>
              <div>
                <p className="text-slate-500 text-sm font-bold uppercase">Open Alerts</p>
                <h2 className="text-3xl font-black text-slate-700">{metrics.openAlerts}</h2>
              </div>
            </div>
            <div className="card p-6 bg-white shadow-sm border border-red-200 bg-red-50 flex items-center gap-4">
              <div className="bg-red-100 p-4 rounded-full text-red-600"><AlertTriangle size={24} /></div>
              <div>
                <p className="text-red-800 text-sm font-bold uppercase">Critical Alerts</p>
                <h2 className="text-3xl font-black text-red-600">{metrics.criticalAlerts}</h2>
              </div>
            </div>
          </div>
        </>
      )}

        {/* System Alerts KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
          <div className="card p-4 bg-white shadow-sm rounded-lg border border-red-100 border-l-4 border-l-red-500">
            <p className="text-gray-500 text-xs font-bold uppercase">Open Alerts</p>
            <h2 className="text-2xl font-black text-slate-800">{systemAlerts.filter(a => a.status === 'open').length}</h2>
          </div>
          <div className="card p-4 bg-white shadow-sm rounded-lg border border-orange-100 border-l-4 border-l-orange-500">
            <p className="text-gray-500 text-xs font-bold uppercase">Critical Alerts</p>
            <h2 className="text-2xl font-black text-slate-800">{systemAlerts.filter(a => a.priority === 'critical').length}</h2>
          </div>
          <div className="card p-4 bg-white shadow-sm rounded-lg border border-green-100 border-l-4 border-l-green-500">
            <p className="text-gray-500 text-xs font-bold uppercase">Resolved (This Month)</p>
            <h2 className="text-2xl font-black text-slate-800">{systemAlerts.filter(a => a.status === 'resolved').length}</h2>
          </div>
          <div className="card p-4 bg-white shadow-sm rounded-lg border border-blue-100 border-l-4 border-l-blue-500">
            <p className="text-gray-500 text-xs font-bold uppercase">Students at Risk</p>
            {/* Simple unique count of students in open attendance alerts */}
            <h2 className="text-2xl font-black text-slate-800">{new Set(systemAlerts.filter(a => a.status === 'open' && a.category === 'attendance').map(a => a.student_id)).size}</h2>
          </div>
        </div>

        {/* System Alerts Widget */}
        <div className="card mt-4 p-6 bg-white border border-slate-200 shadow-sm rounded-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 border-b pb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <AlertTriangle className="text-red-500" /> System Alerts
            </h3>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setAlertFilter('all')} className={`px-3 py-1 text-sm rounded-full font-bold transition-colors ${alertFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>All</button>
              <button onClick={() => setAlertFilter('open')} className={`px-3 py-1 text-sm rounded-full font-bold transition-colors ${alertFilter === 'open' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>Open</button>
              <button onClick={() => setAlertFilter('critical')} className={`px-3 py-1 text-sm rounded-full font-bold transition-colors ${alertFilter === 'critical' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}>Critical</button>
              <button onClick={() => setAlertFilter('attendance')} className={`px-3 py-1 text-sm rounded-full font-bold transition-colors ${alertFilter === 'attendance' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>Attendance</button>
              <button onClick={() => setAlertFilter('resolved')} className={`px-3 py-1 text-sm rounded-full font-bold transition-colors ${alertFilter === 'resolved' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>Resolved</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                  <th className="p-3 font-semibold rounded-tl-lg">Priority</th>
                  <th className="p-3 font-semibold">Alert Type</th>
                  <th className="p-3 font-semibold">Student Name</th>
                  <th className="p-3 font-semibold">Class</th>
                  <th className="p-3 font-semibold">Generated Date</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {systemAlerts.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-500 font-medium">
                      No active system alerts at this time.
                    </td>
                  </tr>
                ) : (
                  systemAlerts.map(alert => (
                    <tr key={alert.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3">
                         <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                           alert.priority === 'critical' ? 'bg-red-500 text-white' : 
                           alert.priority === 'high' ? 'bg-orange-500 text-white' : 
                           alert.priority === 'medium' ? 'bg-yellow-400 text-slate-800' : 'bg-slate-200 text-slate-600'
                         }`}>
                           {alert.priority || 'medium'}
                         </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800 flex items-center gap-2 mt-1">
                         {alert.alert_type}
                      </td>
                      <td className="p-3 font-medium text-slate-800">{alert.students?.name || 'Unknown'}</td>
                      <td className="p-3 text-slate-600">{alert.classes ? `${alert.classes.name} ${alert.classes.section}` : 'Unknown'}</td>
                      <td className="p-3 text-slate-600 text-sm">{new Date(alert.created_at).toLocaleDateString()}</td>
                      <td className="p-3">
                         <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${alert.status === 'open' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                           {alert.status}
                         </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* Attendance Reports Tab */}
      {activeTab === 'attendance' && (
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex-wrap gap-4">
            <div className="flex gap-2 items-center flex-wrap">
              <select className="input-field py-1" value={attendanceDateFilter} onChange={e => setAttendanceDateFilter(e.target.value)}>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
              {attendanceDateFilter === 'custom' && (
                <div className="flex items-center gap-2">
                  <input type="date" className="input-field py-1" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} />
                  <span className="text-gray-500">to</span>
                  <input type="date" className="input-field py-1" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-outline py-1 text-sm flex items-center gap-2" onClick={exportCSV}>
                <FileText size={16} /> Export CSV
              </button>
              <button className="btn btn-outline py-1 text-sm flex items-center gap-2" onClick={() => window.print()}>
                <Printer size={16} /> Print Report
              </button>
            </div>
          </div>

          {loadingAttendance ? (
            <p>Loading attendance data...</p>
          ) : (
            <>
              {/* Today's Summary (or Period Summary) */}
              {(() => {
                const totalRecords = attendanceData.length;
                const presents = attendanceData.filter(a => a.status === 'Present' || a.status === 'Late' || a.status === 'Half Day').length;
                const absents = attendanceData.filter(a => a.status === 'Absent' || a.status === 'Leave').length;
                const percentage = totalRecords > 0 ? ((presents / totalRecords) * 100).toFixed(1) : 0;
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <div className="card p-4 flex items-center gap-4 bg-slate-50 border-l-4 border-primary">
                       <div className="p-3 bg-white rounded-full"><Users className="text-primary" /></div>
                       <div><p className="text-sm font-bold text-slate-500 uppercase">Total Records</p><h3 className="text-2xl font-black">{totalRecords}</h3></div>
                     </div>
                     <div className="card p-4 flex items-center gap-4 bg-green-50 border-l-4 border-green-500">
                       <div className="p-3 bg-white rounded-full"><CheckCircle className="text-green-500" /></div>
                       <div><p className="text-sm font-bold text-slate-500 uppercase">Present</p><h3 className="text-2xl font-black">{presents}</h3></div>
                     </div>
                     <div className="card p-4 flex items-center gap-4 bg-red-50 border-l-4 border-red-500">
                       <div className="p-3 bg-white rounded-full"><XCircle className="text-red-500" /></div>
                       <div><p className="text-sm font-bold text-slate-500 uppercase">Absent</p><h3 className="text-2xl font-black">{absents}</h3></div>
                     </div>
                     <div className="card p-4 flex items-center gap-4 bg-blue-50 border-l-4 border-blue-500">
                       <div className="p-3 bg-white rounded-full"><Calendar className="text-blue-500" /></div>
                       <div><p className="text-sm font-bold text-slate-500 uppercase">Attendance %</p><h3 className="text-2xl font-black">{percentage}%</h3></div>
                     </div>
                  </div>
                );
              })()}

              {/* Absentees Collapsible Section */}
              {(() => {
                const absentees = attendanceData.filter(a => a.status === 'Absent' || a.status === 'Leave');
                if (absentees.length === 0) return null;

                return (
                  <div className="card p-0 overflow-hidden shadow-sm border border-slate-200 mt-6 mb-6">
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
                            const student = studentsData.find(s => s.id === a.student_id);
                            const cls = classesData.find(c => c.id === a.class_id);
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

              <div className="grid md:grid-cols-2 gap-6">
                {/* Class-wise Breakdown */}
                <div className="card p-0 overflow-hidden shadow-sm border border-slate-200">
                  <h3 className="font-bold text-lg p-4 border-b bg-white">Class-wise Breakdown</h3>
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-left bg-white">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="p-3 font-bold text-sm text-slate-600">Class</th>
                          <th className="p-3 font-bold text-sm text-slate-600">Present</th>
                          <th className="p-3 font-bold text-sm text-slate-600">Absent</th>
                          <th className="p-3 font-bold text-sm text-slate-600">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classesData.map(cls => {
                          const classAtt = attendanceData.filter(a => a.class_id === cls.id);
                          if(classAtt.length === 0) return null;
                          const cPresents = classAtt.filter(a => a.status === 'Present' || a.status === 'Late').length;
                          const cAbsents = classAtt.filter(a => a.status === 'Absent' || a.status === 'Leave').length;
                          const cPerc = ((cPresents / classAtt.length) * 100).toFixed(1);
                          return (
                            <tr key={cls.id} className="border-t hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-medium">{cls.name} {cls.section}</td>
                              <td className="p-3 text-green-600 font-bold">{cPresents}</td>
                              <td className="p-3 text-red-600 font-bold">{cAbsents}</td>
                              <td className="p-3 font-bold">{cPerc}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Leaderboards (Top 3 & Bottom 3 Classes) */}
                <div className="card p-0 overflow-hidden shadow-sm border border-slate-200 col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2">
                  {(() => {
                    const classStats = classesData.map(cls => {
                      const classAtt = attendanceData.filter(a => a.class_id === cls.id);
                      const total = classAtt.length;
                      const presents = classAtt.filter(a => ['Present', 'Late', 'Half Day'].includes(a.status)).length;
                      const perc = total > 0 ? (presents / total) * 100 : 0;
                      return { id: cls.id, name: `${cls.name} ${cls.section}`, perc, total };
                    }).filter(c => c.total > 0).sort((a, b) => b.perc - a.perc);
                    
                    const topClasses = classStats.slice(0, 3);
                    const bottomClasses = [...classStats].sort((a, b) => a.perc - b.perc).slice(0, 3);
                    
                    return (
                      <>
                        <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200">
                          <h3 className="font-bold text-lg mb-4 text-green-700 flex items-center gap-2">🏆 Top Attendance</h3>
                          {topClasses.length === 0 ? <p className="text-sm text-slate-500">No data</p> : topClasses.map((cls, i) => (
                            <div key={cls.id} className="flex justify-between items-center mb-3 bg-green-50 p-3 rounded-lg border border-green-100">
                              <span className="font-bold text-slate-700">#{i + 1} {cls.name}</span>
                              <span className="font-black text-green-600">{cls.perc.toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                        <div className="p-4">
                          <h3 className="font-bold text-lg mb-4 text-red-700 flex items-center gap-2">⚠️ Needs Attention</h3>
                          {bottomClasses.length === 0 ? <p className="text-sm text-slate-500">No data</p> : bottomClasses.map((cls, i) => (
                            <div key={cls.id} className="flex justify-between items-center mb-3 bg-red-50 p-3 rounded-lg border border-red-100">
                              <span className="font-bold text-slate-700">#{i + 1} {cls.name}</span>
                              <span className="font-black text-red-600">{cls.perc.toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Trend Charts */}
                <div className="card p-4 shadow-sm border border-slate-200 col-span-1 md:col-span-2">
                  <h3 className="font-bold text-lg mb-4">Attendance Trend</h3>
                  <div className="w-full h-72">
                    {(() => {
                      const trendMap = {};
                      attendanceData.forEach(a => {
                        if (!trendMap[a.date]) {
                          trendMap[a.date] = { date: a.date, Present: 0, Absent: 0 };
                        }
                        if (['Present', 'Late', 'Half Day'].includes(a.status)) trendMap[a.date].Present++;
                        else if (['Absent', 'Leave'].includes(a.status)) trendMap[a.date].Absent++;
                      });
                      const trendData = Object.values(trendMap).sort((a, b) => new Date(a.date) - new Date(b.date));
                      
                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748B'}} tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} />
                            <YAxis tick={{fontSize: 12, fill: '#64748B'}} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Line type="monotone" dataKey="Present" stroke="#22C55E" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                            <Line type="monotone" dataKey="Absent" stroke="#EF4444" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                          </LineChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>

                {/* Attendance Heatmap (Last 5 Active Days) */}
                <div className="card p-0 overflow-hidden shadow-sm border border-slate-200 col-span-1 md:col-span-2">
                  <h3 className="font-bold text-lg p-4 border-b bg-white">Class Heatmap (Recent)</h3>
                  <div className="p-4 overflow-x-auto">
                    {(() => {
                      const dates = [...new Set(attendanceData.map(a => a.date))].sort((a, b) => new Date(b) - new Date(a)).slice(0, 5).reverse();
                      if (dates.length === 0) return <p className="text-slate-500">No recent data</p>;
                      
                      const validClasses = classesData.filter(cls => attendanceData.some(a => a.class_id === cls.id));

                      return (
                        <table className="w-full text-center border-collapse">
                          <thead>
                            <tr>
                              <th className="p-2 text-left text-sm font-bold text-slate-600 border-b">Class</th>
                              {dates.map(d => (
                                <th key={d} className="p-2 text-xs font-bold text-slate-500 border-b whitespace-nowrap">
                                  {new Date(d).toLocaleDateString(undefined, {weekday: 'short', month: 'numeric', day: 'numeric'})}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {validClasses.map(cls => (
                              <tr key={cls.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                                <td className="p-2 text-left font-medium text-sm whitespace-nowrap">{cls.name} {cls.section}</td>
                                {dates.map(d => {
                                  const cellRecords = attendanceData.filter(a => a.class_id === cls.id && a.date === d);
                                  if (cellRecords.length === 0) return <td key={d} className="p-2"><div className="w-6 h-6 rounded bg-slate-100 mx-auto" title="No data"></div></td>;
                                  
                                  const presents = cellRecords.filter(a => ['Present', 'Late', 'Half Day'].includes(a.status)).length;
                                  const perc = (presents / cellRecords.length) * 100;
                                  
                                  let bgColor = 'bg-green-500';
                                  if (perc < 75) bgColor = 'bg-red-500';
                                  else if (perc < 90) bgColor = 'bg-orange-400';
                                  else if (perc < 95) bgColor = 'bg-green-300';
                                  
                                  return (
                                    <td key={d} className="p-2">
                                      <div className={`w-6 h-6 rounded ${bgColor} mx-auto cursor-help transition-transform hover:scale-110 shadow-sm`} title={`${perc.toFixed(0)}% Present`}></div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>

                {/* Frequently Absent Students */}
                <div className="card p-0 overflow-hidden shadow-sm border border-slate-200">
                  <h3 className="font-bold text-lg p-4 border-b bg-white flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-500" /> Frequently Absent
                  </h3>
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-left bg-white">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="p-3 font-bold text-sm text-slate-600">Student</th>
                          <th className="p-3 font-bold text-sm text-slate-600">Class</th>
                          <th className="p-3 font-bold text-sm text-slate-600">Absences</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                           // Aggregate absences by student
                           const studentAbsences = {};
                           attendanceData.forEach(a => {
                             if(a.status === 'Absent' || a.status === 'Leave') {
                               studentAbsences[a.student_id] = (studentAbsences[a.student_id] || 0) + 1;
                             }
                           });
                           
                           // Sort and take top 10
                           const sortedAbsentees = Object.entries(studentAbsences)
                             .sort(([, a], [, b]) => b - a)
                             .slice(0, 10);
                             
                           if(sortedAbsentees.length === 0) {
                             return <tr><td colSpan="3" className="p-4 text-center text-gray-500">No absentees found for this period.</td></tr>;
                           }

                           return sortedAbsentees.map(([studentId, absenceCount]) => {
                             const student = studentsData.find(s => s.id === studentId);
                             const cls = classesData.find(c => c.id === student?.class_id);
                             if(!student) return null;
                             return (
                               <tr key={studentId} className="border-t hover:bg-slate-50 transition-colors">
                                 <td className="p-3 font-medium">{student.name}</td>
                                 <td className="p-3 text-sm text-slate-600">{cls ? `${cls.name} ${cls.section}` : ''}</td>
                                 <td className="p-3 text-red-600 font-bold">{absenceCount} days</td>
                               </tr>
                             );
                           });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="card p-6 bg-white shadow-sm rounded-lg">
          <h2 className="text-xl font-bold mb-4">Global User Search</h2>
          <form onSubmit={handleSearch} className="flex gap-4 mb-6">
            <input 
              type="text" 
              placeholder="Search by Name or UID..." 
              className="input-field flex-1 p-2 border rounded"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary px-6" disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="p-2">Name</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Class/Subject</th>
                    <th className="p-2">UID</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map(user => (
                    <tr key={user.id} className="border-b">
                      <td className="p-2 font-bold">{user.name}</td>
                      <td className="p-2 uppercase text-sm text-gray-500">{user.role}</td>
                      <td className="p-2">{user.class ? `${user.class} ${user.section || ''}` : (user.subject || 'N/A')}</td>
                      <td className="p-2 text-xs text-gray-400">{user.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Notices Tab */}
      {activeTab === 'notices' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6 bg-white shadow-sm rounded-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Send size={20} /> Create Notice</h2>
            <form onSubmit={handleSendNotice} className="flex flex-col gap-4">
              <div>
                <label className="block font-bold mb-1">Notice Title</label>
                <input required type="text" className="input-field w-full p-2 border rounded" value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} />
              </div>
              <div className="mb-8">
                <label className="block font-bold mb-1">Message</label>
                <div style={{ marginBottom: '10px' }}>
                  <Editor value={noticeMessage} onChange={e => setNoticeMessage(e.target.value)} style={{ minHeight: '150px' }}>
                    <Toolbar>
                      <BtnUndo />
                      <BtnRedo />
                      <Separator />
                      <BtnBold />
                      <BtnItalic />
                      <BtnUnderline />
                      <BtnStrikeThrough />
                      <Separator />
                      <BtnNumberedList />
                      <BtnBulletList />
                      <Separator />
                      <BtnLink />
                      <BtnClearFormatting />
                      <HtmlButton />
                      <BtnStyles />
                      <Separator />
                      <div className="flex items-center" style={{ padding: '0 4px' }}>
                        <input 
                          type="color" 
                          title="Text Color"
                          className="cursor-pointer" 
                          style={{ padding: 0, width: '22px', height: '22px', border: 'none', background: 'transparent' }}
                          onChange={(e) => {
                            e.preventDefault();
                            document.execCommand('foreColor', false, e.target.value);
                          }} 
                        />
                      </div>
                    </Toolbar>
                  </Editor>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Target Audience</label>
                <select className="input-field w-full p-2 border rounded" value={noticeAudience} onChange={e => setNoticeAudience(e.target.value)}>
                  <option value="all">Entire School</option>
                  <option value="students">Just the students</option>
                  <option value="teachers">Just the teachers</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary mt-2">Publish Notice</button>
            </form>
          </div>

          <div className="card p-6 bg-white shadow-sm rounded-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Bell size={20} /> Recent Notices</h2>
            {recentNotices.length === 0 ? <p className="text-gray-500">No recent notices.</p> : (
              <div className="flex flex-col gap-4">
                {recentNotices.map(notice => (
                  <div key={notice.id} className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg">{notice.title}</h3>
                      <span className="text-xs font-bold uppercase bg-gray-200 px-2 py-1 rounded text-gray-600">{notice.audience}</span>
                    </div>
                    <div className="text-gray-600 text-sm" dangerouslySetInnerHTML={{ __html: notice.message }}></div>
                    <p className="text-xs text-gray-400 mt-2">{new Date(notice.publish_date).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="card p-6 bg-white shadow-sm rounded-lg max-w-3xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings size={20} /> School Settings & Branding</h2>
          
          <div className="border border-slate-200 rounded-lg p-6 bg-slate-50 mb-6">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">Principal Digital Signature</h3>
            <p className="text-slate-600 text-sm mb-4">
              Upload the official digital signature of the Principal. This signature will automatically be printed on all student Report Cards.
              For best results, upload a PNG image with a transparent background.
            </p>
            
            <div className="flex flex-col gap-4 items-start">
              <input 
                type="file" 
                accept="image/png, image/jpeg, image/jpg" 
                className="input-field p-2 bg-white border border-slate-300 rounded" 
                onChange={handleFileSelect}
                disabled={uploadingSig}
              />
              {selectedFile && (
                <button 
                  onClick={handleSignatureUpload}
                  disabled={uploadingSig}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Upload size={18} /> {uploadingSig ? 'Uploading...' : 'Save & Publish Signature'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrincipalPortal;
