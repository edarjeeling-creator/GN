import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, CheckCircle, CheckCircle2, Clock, Trash2, CheckSquare, Search, Calendar, Activity, Download, Book, FileText, Award, AlertTriangle, UserCheck, X, Eye } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { motion, AnimatePresence } from 'framer-motion';
import FeeDashboardView from '../components/FeeDashboardView';
import CalendarWidget from '../components/CalendarWidget';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { formatStudentDisplayName } from '../utils/studentUtils';
import StudentTestExamNotices from '../components/TestExamCommunication/StudentTestExamNotices';

const StudentPortal = () => {
  const { profile } = useAuth();
  const { students, featureAccess, classes } = useData();
  const [activeTab, setActiveTab] = useState('overview');
  const [notifications, setNotifications] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifSearch, setNotifSearch] = useState('');
  const [dismissedPresentBanner, setDismissedPresentBanner] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState('all');

  const studentData = students?.find(s => {
    if (profile?.id) return s.id === profile.id;
    if (profile?.uid) return s.uid === profile.uid;
    if (profile?.name) return s.name && s.name.trim().toLowerCase() === profile.name.trim().toLowerCase();
    return false;
  }) || (profile?.role === 'student' ? profile : null);

  const currentStudentId = studentData?.id || studentData?.student_id || profile?.student_id || profile?.id;
  const classId = studentData?.class_id || profile?.class_id;
  const studentClass = classes?.find(c => c.id === classId) || (profile?.className ? { name: profile.class, section: profile.section } : null);

  const fetchAttendanceHistory = async () => {
    if (!currentStudentId) return;
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', currentStudentId)
        .order('date', { ascending: false });
      if (!error && data && data.length > 0) {
        setAttendanceRecords(data);
        return;
      }
    } catch (e) {
      console.warn('Direct attendance select warning:', e);
    }

    // Fallback: Use SECURITY DEFINER RPC get_student_report which bypasses student RLS
    const currentUid = studentData?.uid || profile?.uid;
    if (currentUid) {
      try {
        const { data: reportData, error: reportErr } = await supabase.rpc('get_student_report', {
          p_uid: String(currentUid),
          p_academic_year: '2026'
        });
        if (!reportErr && reportData?.attendance) {
          setAttendanceRecords(reportData.attendance);
        }
      } catch (rpcErr) {
        console.warn('RPC attendance fallback warning:', rpcErr);
      }
    }
  };

  const fetchNotifications = async () => {
    if (!currentStudentId) return;

    let personalData = [];
    // 1. Safe query to student_notifications (if table exists)
    try {
      const { data, error } = await supabase
        .from('student_notifications')
        .select('*')
        .eq('student_id', currentStudentId)
        .neq('is_invalid', true);
      if (!error && data) personalData = data;
    } catch (e) {}

    // 2. Direct student notifications from notifications table
    try {
      const { data: directNotifs, error: directErr } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentStudentId)
        .order('created_at', { ascending: false });
      if (!directErr && directNotifs && directNotifs.length > 0) {
        personalData = [
          ...personalData,
          ...directNotifs.map(dn => ({
            id: dn.id,
            title: dn.title,
            message: dn.message,
            type: dn.type || 'absence_alert',
            is_read: dn.is_read,
            created_at: dn.created_at
          }))
        ];
      }
    } catch (e) {}

    // 3. General school notices & class-specific notices
    let formattedGeneral = [];
    try {
      const allowedAudiences = ['all', 'students'];
      const effectiveClassId = classId || studentClass?.id;
      if (effectiveClassId) {
        allowedAudiences.push(`class:${effectiveClassId}`);
      }
      const { data: generalData } = await supabase
        .from('notices')
        .select('*')
        .in('target_audience', allowedAudiences);
      if (generalData) {
        formattedGeneral = generalData.map(n => ({
          id: n.id,
          title: n.title,
          message: n.content,
          type: 'general_notice',
          is_read: true,
          created_at: n.publish_date
        }));
      }
    } catch (e) {}

    // 4. Derive Official Absence Alerts from attendanceRecords
    const clsName = studentClass ? `${studentClass.name} ${studentClass.section || ''}` : (studentData?.className || '');
    const attendanceAlerts = (attendanceRecords || [])
      .filter(r => ['Absent', 'Leave', 'Half Day'].includes(r.status))
      .map(r => {
        const ackKey = `student_ack_absence_${currentStudentId}_${r.id || r.date}`;
        const readKey = `student_read_absence_${currentStudentId}_${r.id || r.date}`;
        const isAcknowledged = !!localStorage.getItem(ackKey);
        const isRead = isAcknowledged || !!localStorage.getItem(readKey);
        const formattedDate = new Date(r.date).toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        return {
          id: `att_absence_${r.id || r.date}`,
          originalRecordId: r.id,
          date: r.date,
          title: `🚨 Daily Absence Alert - Marked ${r.status}`,
          message: `You were marked <strong>${r.status}</strong> on ${formattedDate} in Class ${clsName || 'N/A'}. ${
            r.remarks ? `Remarks: "${r.remarks}". ` : ''
          }If you have informed the school or believe this was marked in error, please contact your class teacher.`,
          type: 'absence_alert',
          status: r.status,
          is_read: isRead,
          is_acknowledged: isAcknowledged,
          acknowledged_at: localStorage.getItem(ackKey),
          created_at: r.created_at || (r.date && r.date.includes('T') ? r.date : `${r.date}T09:00:00.000Z`),
          is_attendance_derived: true
        };
      });

    // 5. Derive Official Present Attendance Updates from attendanceRecords
    const presentAlerts = (attendanceRecords || [])
      .filter(r => ['Present', 'Late'].includes(r.status))
      .slice(0, 15) // Keep recent 15 records
      .map(r => {
        const ackKey = `student_ack_present_${currentStudentId}_${r.id || r.date}`;
        const readKey = `student_read_present_${currentStudentId}_${r.id || r.date}`;
        const isAcknowledged = !!localStorage.getItem(ackKey);
        const isRead = isAcknowledged || !!localStorage.getItem(readKey);
        const formattedDate = new Date(r.date).toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        return {
          id: `att_present_${r.id || r.date}`,
          originalRecordId: r.id,
          date: r.date,
          title: `✅ Daily Attendance - Marked ${r.status}`,
          message: `You were marked <strong>${r.status}</strong> on ${formattedDate} in Class ${clsName || 'N/A'}. ${
            r.remarks ? `Remarks: "${r.remarks}". ` : ''
          }Your presence has been officially recorded and verified by your class teacher.`,
          type: 'attendance_present',
          status: r.status,
          is_read: isRead,
          is_acknowledged: isAcknowledged,
          acknowledged_at: localStorage.getItem(ackKey),
          created_at: r.created_at || (r.date && r.date.includes('T') ? r.date : `${r.date}T09:00:00.000Z`),
          is_attendance_derived: true
        };
      });

    // Merge and deduplicate
    const combined = [...personalData, ...attendanceAlerts, ...presentAlerts, ...formattedGeneral];
    const uniqueMap = new Map();
    combined.forEach(item => {
      const key = (item.type === 'absence_alert' || item.type === 'attendance_present') && item.date 
        ? `${item.type}_${item.date}` 
        : item.id;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    const finalAlerts = Array.from(uniqueMap.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setNotifications(finalAlerts);
    setLoading(false);
  };

  useEffect(() => {
    if (currentStudentId) {
      fetchAttendanceHistory();
    }
  }, [currentStudentId]);

  useEffect(() => {
    if (currentStudentId) {
      fetchNotifications();
    }
  }, [currentStudentId, attendanceRecords]);

  // Real-time listener on attendance table
  useEffect(() => {
    if (!currentStudentId) return;
    const attendanceChannel = supabase
      .channel(`student_attendance_rt_${currentStudentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance',
        filter: `student_id=eq.${currentStudentId}`
      }, () => {
        fetchAttendanceHistory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
    };
  }, [currentStudentId]);

  const handleMarkAsRead = async (notificationId) => {
    const notif = notifications.find(n => n.id === notificationId);
    if (notif?.is_attendance_derived) {
      const keyPrefix = notif.type === 'attendance_present' ? 'student_read_present_' : 'student_read_absence_';
      localStorage.setItem(`${keyPrefix}${currentStudentId}_${notif.originalRecordId || notif.date}`, 'true');
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
      return;
    }
    try {
      await supabase.from('student_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', notificationId);
    } catch (e) {}
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    notifications.forEach(n => {
      if (n.is_attendance_derived) {
        const keyPrefix = n.type === 'attendance_present' ? 'student_read_present_' : 'student_read_absence_';
        localStorage.setItem(`${keyPrefix}${currentStudentId}_${n.originalRecordId || n.date}`, 'true');
      }
    });
    const unreadIds = notifications.filter(n => !n.is_read && !n.is_attendance_derived).map(n => n.id);
    if (unreadIds.length > 0) {
      try {
        await supabase.from('student_notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', unreadIds);
      } catch (e) {}
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleDeleteOldNotifications = async () => {
    const readIds = notifications.filter(n => n.is_read && n.type !== 'general_notice' && !n.is_attendance_derived).map(n => n.id);
    if (readIds.length > 0) {
      try {
        await supabase.from('student_notifications').delete().in('id', readIds);
      } catch (e) {}
    }
    setNotifications(prev => prev.filter(n => !n.is_read || n.type === 'general_notice' || n.is_attendance_derived));
  };

  const handleAcknowledge = async (notificationId) => {
    const notif = notifications.find(n => n.id === notificationId);
    const nowIso = new Date().toISOString();
    if (notif?.is_attendance_derived) {
      const keyPrefix = notif.type === 'attendance_present' ? 'student_ack_present_' : 'student_ack_absence_';
      localStorage.setItem(`${keyPrefix}${currentStudentId}_${notif.originalRecordId || notif.date}`, nowIso);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_acknowledged: true, acknowledged_at: nowIso, is_read: true } : n));
      return;
    }
    try {
      await supabase.from('student_notifications').update({ is_acknowledged: true, acknowledged_at: nowIso, is_read: true }).eq('id', notificationId);
    } catch (e) {}
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_acknowledged: true, acknowledged_at: nowIso, is_read: true } : n));
  };

  const handleAcknowledgeAbsence = (record) => {
    const nowIso = new Date().toISOString();
    const ackKey = `student_ack_absence_${currentStudentId}_${record.originalRecordId || record.id || record.date}`;
    localStorage.setItem(ackKey, nowIso);
    fetchNotifications();
  };

  const handleAcknowledgePresent = (record) => {
    const nowIso = new Date().toISOString();
    const ackKey = `student_ack_present_${currentStudentId}_${record.originalRecordId || record.id || record.date}`;
    localStorage.setItem(ackKey, nowIso);
    fetchNotifications();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const filteredNotifications = notifications.filter(n => n.title.toLowerCase().includes(notifSearch.toLowerCase()) || n.message.toLowerCase().includes(notifSearch.toLowerCase()));

  const todayStr = new Date().toISOString().split('T')[0];
  const localToday = new Date();
  const localTodayStr = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;

  const isMatchingDate = (dateVal, targetStr) => {
    if (!dateVal || !targetStr) return false;
    const cleanDate = dateVal.includes('T') ? dateVal.split('T')[0] : dateVal;
    return cleanDate === targetStr;
  };

  const todayRecord = attendanceRecords.find(r => 
    isMatchingDate(r.date, todayStr) || isMatchingDate(r.date, localTodayStr)
  );

  const todayAbsence = todayRecord && ['Absent', 'Leave', 'Half Day'].includes(todayRecord.status) ? todayRecord : null;
  const todayPresent = todayRecord && ['Present', 'Late'].includes(todayRecord.status) ? todayRecord : null;

  const recentUnackAbsence = !todayAbsence && attendanceRecords.find(r => {
    if (!r.date || !['Absent', 'Leave'].includes(r.status)) return false;
    const rDate = new Date(r.date);
    const now = new Date();
    const diffDays = (now - rDate) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) return false;
    const ackKey = `student_ack_absence_${currentStudentId}_${r.id || r.date}`;
    return !localStorage.getItem(ackKey);
  });

  const latestAttendance = attendanceRecords && attendanceRecords.length > 0 ? attendanceRecords[0] : null;
  const isLatestRecentPresent = latestAttendance && ['Present', 'Late'].includes(latestAttendance.status) && (() => {
    const rDate = new Date(latestAttendance.date);
    const now = new Date();
    const diffDays = (now - rDate) / (1000 * 60 * 60 * 24);
    return diffDays <= 4;
  })();

  const activePresentAlert = todayPresent || (!todayAbsence && !recentUnackAbsence && isLatestRecentPresent ? latestAttendance : null);
  const activeAbsenceAlert = todayAbsence || (!todayPresent && recentUnackAbsence);
  const showUnackAbsenceNotice = todayPresent && recentUnackAbsence;

  const isNotExpired = (expiresAt) => {
    if (!expiresAt) return true;
    return new Date() < new Date(expiresAt);
  };

  let isPythonEnabled = false;
  if (featureAccess && Array.isArray(featureAccess) && studentData) {
    const studentRule = featureAccess.find(f => f.feature_name === 'python_portal' && f.target_type === 'student' && String(f.target_id) === String(studentData.id));
    const classRule = featureAccess.find(f => f.feature_name === 'python_portal' && f.target_type === 'class' && String(f.target_id) === String(classId));
    
    if (studentRule) {
      if (studentRule.is_enabled && isNotExpired(studentRule.expires_at)) {
        isPythonEnabled = true;
      }
    } else if (classRule) {
      if (classRule.is_enabled && isNotExpired(classRule.expires_at)) {
        isPythonEnabled = true;
      }
    }
  }

  const totalDays = attendanceRecords.length;
  const presentDays = attendanceRecords.filter(r => ['Present', 'Late', 'Half Day'].includes(r.status)).length;
  const absentDays = attendanceRecords.filter(r => ['Absent', 'Leave'].includes(r.status)).length;
  const attendancePercentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : 0;
  const recentAbsences = attendanceRecords.filter(r => ['Absent', 'Leave'].includes(r.status)).slice(0, 5);

  const generateCertificate = () => {
    const certId = `CERT-${new Date().getTime().toString().slice(-6)}-${studentData?.roll_no || 'XX'}`;
    const generatedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    
    const certDiv = document.createElement('div');
    certDiv.style.padding = '40px';
    certDiv.style.fontFamily = 'Arial, sans-serif';
    certDiv.style.color = '#1e293b';
    certDiv.style.position = 'relative';
    certDiv.innerHTML = `
      <div style="border: 8px solid #0f172a; padding: 30px; text-align: center; background: white; position: relative;">
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.05; font-size: 200px;">🎓</div>
        <h1 style="color: #0f172a; font-size: 32px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 2px;">Gyanoday Niketan</h1>
        <p style="color: #64748b; font-size: 14px; margin-bottom: 30px; text-transform: uppercase;">Official Attendance Certificate</p>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; text-align: left;">
          <div>
            <p style="margin: 5px 0;"><strong>Certificate ID:</strong> ${certId}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${generatedOn}</p>
          </div>
          ${studentData?.picture_url ? `<img src="${studentData.picture_url}" style="width: 100px; height: 100px; border-radius: 8px; border: 2px solid #cbd5e1; object-fit: cover;" />` : `<div style="width: 100px; height: 100px; border-radius: 8px; background: #f1f5f9; border: 2px solid #cbd5e1;"></div>`}
        </div>
        <p style="font-size: 18px; line-height: 1.6; margin-bottom: 30px;">
          This is to certify that <strong>${formatStudentDisplayName(studentData?.name)}</strong>, <br/>
          Admission Number <strong>${studentData?.uid}</strong>, is a bona fide student of <br/>
          Class <strong>${studentData?.classes?.name || ''} ${studentData?.classes?.section || ''}</strong>.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
          <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1;">
            <th style="padding: 12px; text-align: left;">Total Working Days</th>
            <th style="padding: 12px; text-align: left;">Days Present</th>
            <th style="padding: 12px; text-align: left;">Days Absent</th>
            <th style="padding: 12px; text-align: left;">Attendance %</th>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; text-align: left; font-size: 18px; font-weight: bold;">${totalDays}</td>
            <td style="padding: 12px; text-align: left; font-size: 18px; font-weight: bold; color: #16a34a;">${presentDays}</td>
            <td style="padding: 12px; text-align: left; font-size: 18px; font-weight: bold; color: #dc2626;">${absentDays}</td>
            <td style="padding: 12px; text-align: left; font-size: 18px; font-weight: bold;">${attendancePercentage}%</td>
          </tr>
        </table>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 60px;">
          <div style="text-align: center;">
            <div style="width: 80px; height: 80px; border: 2px solid #0f172a; padding: 4px;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFY:${certId}" style="width: 100%; height: 100%;" />
            </div>
            <p style="font-size: 10px; margin-top: 5px; color: #64748b;">Scan to Verify</p>
          </div>
          <div style="text-align: center;">
            <div style="border-bottom: 1px solid #0f172a; width: 200px; height: 40px; margin-bottom: 10px; font-family: 'Brush Script MT', cursive; font-size: 24px; display: flex; align-items: flex-end; justify-content: center;">
              J. Doe
            </div>
            <p style="font-size: 14px; font-weight: bold; margin: 0;">Principal Signature</p>
            <p style="font-size: 12px; color: #64748b; margin: 0;">Gyanoday Niketan</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(certDiv);
    html2pdf().set({ margin: 10, filename: `Attendance_Certificate_${formatStudentDisplayName(studentData?.name).replace(/ /g, '_')}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(certDiv).save().then(() => document.body.removeChild(certDiv));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Student Portal</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
          <p className="text-slate-400">Welcome back, <strong className="text-brand-400">{formatStudentDisplayName(studentData?.name || profile?.name)}</strong></p>
          {studentClass && (
            <Badge variant="primary" className="w-fit bg-brand-950/40 text-brand-300 border border-brand-900/30">
              Class {studentClass.name} {studentClass.section || ''}
            </Badge>
          )}
        </div>
      </div>

      {/* High-Contrast Daily Absence Alert Banner */}
      {activeAbsenceAlert && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="p-4 sm:p-5 rounded-2xl bg-red-950/70 border-l-4 border-l-red-500 border border-red-800/80 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-red-600/30 text-red-400 rounded-xl border border-red-500/40 shrink-0 mt-0.5">
              <AlertTriangle size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-black text-white text-base sm:text-lg tracking-tight">
                  🚨 Daily Absence Alert - Marked {activeAbsenceAlert.status} {todayAbsence ? 'Today' : ''}
                </span>
                <Badge variant="danger" className="bg-red-600 text-white font-black uppercase text-xs px-2.5 py-0.5 shadow-sm">
                  {activeAbsenceAlert.status}
                </Badge>
              </div>
              <p className="text-slate-200 text-sm mt-1 leading-relaxed font-medium">
                You were marked <strong className="text-white underline decoration-red-400">{activeAbsenceAlert.status}</strong> on {new Date(activeAbsenceAlert.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} in Class {studentClass ? `${studentClass.name} ${studentClass.section || ''}` : (studentData?.className || '')}. If you believe this is an error or have informed the school, please contact your class teacher.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
            <Button 
              onClick={() => handleAcknowledgeAbsence(activeAbsenceAlert)} 
              className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md flex-1 md:flex-none"
            >
              <CheckCircle size={14} className="mr-1.5" /> Acknowledge Alert
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setActiveTab('attendance')} 
              className="border-red-700/80 text-red-200 hover:bg-red-900/40 text-xs h-9 px-3 rounded-xl flex-1 md:flex-none"
            >
              Attendance Details →
            </Button>
          </div>
        </motion.div>
      )}

      {/* High-Contrast Daily Present Attendance Banner */}
      {activePresentAlert && !activeAbsenceAlert && !dismissedPresentBanner && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="p-4 sm:p-5 rounded-2xl bg-emerald-950/70 border-l-4 border-l-emerald-500 border border-emerald-800/80 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-emerald-600/30 text-emerald-400 rounded-xl border border-emerald-500/40 shrink-0 mt-0.5">
              <CheckCircle2 size={24} className="text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-black text-white text-base sm:text-lg tracking-tight">
                  ✅ Daily Attendance - Marked {activePresentAlert.status} {todayPresent ? 'Today' : ''}
                </span>
                <Badge variant="success" className="bg-emerald-600 text-white font-black uppercase text-xs px-2.5 py-0.5 shadow-sm">
                  {activePresentAlert.status}
                </Badge>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/40">
                  Verified by Class Teacher
                </span>
              </div>
              <p className="text-slate-200 text-sm mt-1 leading-relaxed font-medium">
                You were marked <strong className="text-white underline decoration-emerald-400">{activePresentAlert.status}</strong> on {new Date(activePresentAlert.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} in Class {studentClass ? `${studentClass.name} ${studentClass.section || ''}` : (studentData?.className || '')}. {activePresentAlert.remarks ? `Remarks: "${activePresentAlert.remarks}". ` : ''}Your presence has been recorded in the school attendance register.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
            {localStorage.getItem(`student_ack_present_${currentStudentId}_${activePresentAlert.originalRecordId || activePresentAlert.id || activePresentAlert.date}`) ? (
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 bg-emerald-900/50 px-3 py-2 rounded-xl border border-emerald-700/50">
                <CheckCircle size={14} /> Confirmed
              </span>
            ) : (
              <Button 
                onClick={() => handleAcknowledgePresent(activePresentAlert)} 
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md flex-1 md:flex-none"
              >
                <CheckCircle size={14} className="mr-1.5" /> Confirm Attendance
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => setActiveTab('attendance')} 
              className="border-emerald-700/80 text-emerald-200 hover:bg-emerald-900/40 text-xs h-9 px-3 rounded-xl flex-1 md:flex-none"
            >
              Attendance Details →
            </Button>
            <button 
              onClick={() => setDismissedPresentBanner(true)} 
              className="p-2 text-emerald-400/70 hover:text-emerald-200 rounded-xl hover:bg-emerald-900/40 transition-colors"
              title="Dismiss banner"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Secondary Notice if Present Today but has Pending Past Absence to Acknowledge */}
      {showUnackAbsenceNotice && (
        <motion.div 
          initial={{ opacity: 0, y: -4 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="p-3.5 sm:p-4 rounded-xl bg-red-950/50 border-l-4 border-l-red-500 border border-red-800/60 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-red-600/30 text-red-400 rounded-lg shrink-0">
              <AlertTriangle size={16} />
            </div>
            <p className="text-xs sm:text-sm text-slate-200 font-medium">
              Notice: You have a previous absence record from <strong className="text-white">{new Date(recentUnackAbsence.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong> in Class {clsName} awaiting acknowledgment.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button 
              onClick={() => handleAcknowledgeAbsence(recentUnackAbsence)} 
              size="sm"
              className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs h-8 px-3 rounded-lg"
            >
              <CheckCircle size={12} className="mr-1" /> Acknowledge Alert
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setActiveTab('attendance')} 
              size="sm"
              className="border-red-800 text-red-200 hover:bg-red-900/30 text-xs h-8 px-2.5 rounded-lg"
            >
              Details →
            </Button>
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto custom-scrollbar border-b border-slate-800/80 hide-scrollbar pb-2">
        <div className="flex gap-2 sm:gap-6 min-w-max">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'test_exam_notices', label: 'Test & Exam Notices' },
            { id: 'fees', label: 'My Fees' },
            { id: 'attendance', label: 'Attendance' },
            { id: 'notifications', label: 'Alerts', badge: unreadCount > 0 ? unreadCount : null }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-3 px-1 text-sm sm:text-base font-semibold transition-colors flex items-center gap-2 ${activeTab === tab.id ? 'text-brand-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {tab.label}
              {tab.badge && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{tab.badge}</span>}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-400" />
              )}
            </button>
          ))}
          {isPythonEnabled && (
            <a href="/python-student" className="pb-3 px-1 text-sm sm:text-base font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5 ml-auto sm:ml-0">
              Python Lab <ArrowRight size={14} />
            </a>
          )}
        </div>
      </div>

      {/* Overview Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <CalendarWidget />

            {/* Quick Attendance Status Widget */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-xl border shrink-0 ${
                  todayPresent 
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                    : todayAbsence 
                      ? 'bg-red-950/60 text-red-400 border-red-800/60'
                      : 'bg-slate-800/50 text-slate-400 border-slate-700/60'
                }`}>
                  {todayPresent ? <CheckCircle2 size={24} /> : todayAbsence ? <AlertTriangle size={24} /> : <Calendar size={24} />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Today's Attendance Status</span>
                    {todayPresent ? (
                      <Badge variant="success" className="bg-emerald-600 text-white text-[10px] font-black uppercase px-2 py-0.5">PRESENT</Badge>
                    ) : todayAbsence ? (
                      <Badge variant="danger" className="bg-red-600 text-white text-[10px] font-black uppercase px-2 py-0.5">ABSENT</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-[10px] font-medium px-2 py-0.5">PENDING ROLL CALL</Badge>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-200 mt-1">
                    {todayPresent ? (
                      <span>Marked <strong className="text-emerald-400 font-bold">{todayPresent.status}</strong> today by class teacher in Class {clsName}.</span>
                    ) : todayAbsence ? (
                      <span>Marked <strong className="text-red-400 font-bold">{todayAbsence.status}</strong> today in Class {clsName}.</span>
                    ) : latestAttendance ? (
                      <span>Roll call pending for today. Previous record: Marked <strong className={['Present', 'Late'].includes(latestAttendance.status) ? 'text-emerald-400' : 'text-red-400'}>{latestAttendance.status}</strong> on {new Date(latestAttendance.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.</span>
                    ) : (
                      'Attendance will reflect here once marked by your teacher.'
                    )}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setActiveTab('attendance')}
                className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800 self-stretch sm:self-auto shrink-0"
              >
                View Full Attendance →
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link to="/study-materials">
                <Card hoverable className="h-full border-t-4 border-t-brand-500 group premium-card">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="w-12 h-12 bg-brand-950/30 text-brand-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Book size={24} />
                  </div>
                  <h3 className="font-bold text-xl mb-2 text-slate-200 group-hover:text-brand-400 transition-colors">Study Materials</h3>
                  <p className="text-slate-400 text-sm flex-1">View and download materials uploaded by your teachers.</p>
                  <ArrowRight size={20} className="text-brand-455/50 group-hover:text-brand-400 transition-colors mt-4 self-end" />
                </CardContent>
              </Card>
            </Link>
            
            <Link to="/assignments">
              <Card hoverable className="h-full border-t-4 border-t-amber-500 group premium-card">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="w-12 h-12 bg-amber-950/30 text-amber-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <FileText size={24} />
                  </div>
                  <h3 className="font-bold text-xl mb-2 text-slate-200 group-hover:text-amber-400 transition-colors">Assignments</h3>
                  <p className="text-slate-400 text-sm flex-1">Submit your assignments and view teacher feedback.</p>
                  <ArrowRight size={20} className="text-amber-400/50 group-hover:text-amber-400 transition-colors mt-4 self-end" />
                </CardContent>
              </Card>
            </Link>

            <Link to="/result">
              <Card hoverable className="h-full border-t-4 border-t-emerald-500 group premium-card">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-emerald-950/30 text-emerald-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Award size={24} />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-700/50">
                      Tuesday Assembly
                    </span>
                  </div>
                  <h3 className="font-bold text-xl mb-2 text-slate-200 group-hover:text-emerald-400 transition-colors">My Marks</h3>
                  <p className="text-slate-400 text-sm flex-1">View report cards and exam results. Final term marks reflect on Tuesday Morning Assembly.</p>
                  <ArrowRight size={20} className="text-emerald-400/50 group-hover:text-emerald-400 transition-colors mt-4 self-end" />
                </CardContent>
              </Card>
            </Link>

            {isPythonEnabled && (
              <Link to="/python-student">
                <Card hoverable className="h-full border-t-4 border-t-indigo-500 group premium-card">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="w-12 h-12 bg-indigo-950/30 text-indigo-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <span className="text-2xl">🐍</span>
                    </div>
                    <h3 className="font-bold text-xl mb-2 text-slate-200 group-hover:text-indigo-400 transition-colors">Python Patshala</h3>
                    <p className="text-slate-400 text-sm flex-1">Access interactive Python coding lessons and assignments.</p>
                    <ArrowRight size={20} className="text-indigo-400/50 group-hover:text-indigo-400 transition-colors mt-4 self-end" />
                  </CardContent>
                </Card>
              </Link>
            )}
            </div>
          </motion.div>
        )}

        {/* Fees Tab */}
        {activeTab === 'fees' && (
          <motion.div key="fees" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {studentData?.id ? (
              <FeeDashboardView studentId={studentData.id} />
            ) : (
              <div className="text-center p-8 text-slate-500">Student data not loaded.</div>
            )}
          </motion.div>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <motion.div key="attendance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-200">
                <Calendar className="text-brand-400" /> Attendance History
              </h2>
              <Button onClick={generateCertificate} variant="primary" className="flex items-center gap-2 w-full sm:w-auto bg-brand-600 hover:bg-brand-500">
                <Download size={18} /> Official Certificate
              </Button>
            </div>

            {/* Today's Highlight Status */}
            {todayPresent ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-800/80 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-emerald-600/30 text-emerald-400 rounded-xl border border-emerald-500/40 shrink-0">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Today's Attendance Status</span>
                      <Badge variant="success" className="bg-emerald-600 text-white font-black uppercase text-xs px-2.5 py-0.5 shadow-sm">
                        {todayPresent.status}
                      </Badge>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/40">
                        Verified in Roll Call
                      </span>
                    </div>
                    <p className="text-slate-200 text-sm mt-1 font-medium">
                      You are marked <strong className="text-emerald-400 font-bold">{todayPresent.status}</strong> today ({new Date(todayPresent.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}) in Class {clsName}. {todayPresent.remarks ? `Remarks: "${todayPresent.remarks}".` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-800/60">
                    <CheckCircle size={14} /> Recorded by Class Teacher
                  </span>
                </div>
              </div>
            ) : todayAbsence ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-950/80 to-slate-900 border border-red-800/80 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-red-600/30 text-red-400 rounded-xl border border-red-500/40 shrink-0">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-red-400">Today's Attendance Status</span>
                      <Badge variant="danger" className="bg-red-600 text-white font-black uppercase text-xs px-2.5 py-0.5 shadow-sm">
                        {todayAbsence.status}
                      </Badge>
                    </div>
                    <p className="text-slate-200 text-sm mt-1 font-medium">
                      You are marked <strong className="text-red-400 font-bold">{todayAbsence.status}</strong> today ({new Date(todayAbsence.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}) in Class {clsName}. If incorrect, please contact your class teacher.
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => handleAcknowledgeAbsence(todayAbsence)} 
                  className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md shrink-0"
                >
                  <CheckCircle size={14} className="mr-1.5" /> Acknowledge Alert
                </Button>
              </div>
            ) : (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-slate-800 text-slate-400 rounded-xl border border-slate-700/60 shrink-0">
                    <Clock size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Today's Attendance Status</span>
                      <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-xs px-2.5 py-0.5">
                        PENDING ROLL CALL
                      </Badge>
                    </div>
                    <p className="text-slate-300 text-sm mt-1">
                      {latestAttendance 
                        ? `Attendance has not yet been submitted for today. Most recent record: Marked ${latestAttendance.status} on ${new Date(latestAttendance.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}.`
                        : 'Attendance records will appear here as soon as submitted by your class teacher.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-slate-900 to-indigo-950/30 border-slate-800 text-center">
                <CardContent className="p-6">
                  <p className="text-xs font-bold text-brand-400/80 uppercase tracking-wider mb-2">Overall Attendance</p>
                  <h3 className={`text-5xl font-black ${attendancePercentage >= 75 ? 'text-emerald-400' : 'text-red-400'}`}>{attendancePercentage}%</h3>
                </CardContent>
              </Card>
              <Card className="text-center premium-card">
                <CardContent className="p-6">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Days Present</p>
                  <h3 className="text-5xl font-black text-slate-200">{presentDays}</h3>
                </CardContent>
              </Card>
              <Card className="text-center premium-card">
                <CardContent className="p-6">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Days Absent</p>
                  <h3 className="text-5xl font-black text-red-400">{absentDays}</h3>
                </CardContent>
              </Card>
            </div>

            {/* Attendance Records Log */}
            <Card className="premium-card">
              <CardHeader className="border-b border-slate-800/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-200">
                  <Activity size={18} className="text-brand-400" /> Attendance History Log
                </CardTitle>
                <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 self-start sm:self-auto">
                  <button 
                    onClick={() => setAttendanceFilter('all')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${attendanceFilter === 'all' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    All ({totalDays})
                  </button>
                  <button 
                    onClick={() => setAttendanceFilter('present')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${attendanceFilter === 'present' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Present ({presentDays})
                  </button>
                  <button 
                    onClick={() => setAttendanceFilter('absent')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${attendanceFilter === 'absent' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Absent & Leaves ({absentDays})
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {(() => {
                  const filteredList = attendanceRecords.filter(r => {
                    if (attendanceFilter === 'present') return ['Present', 'Late'].includes(r.status);
                    if (attendanceFilter === 'absent') return ['Absent', 'Leave', 'Half Day'].includes(r.status);
                    return true;
                  });

                  if (filteredList.length === 0) {
                    return (
                      <div className="bg-slate-900/30 text-slate-400 border border-slate-800/60 p-8 rounded-xl text-center">
                        <CheckCircle size={28} className="mx-auto mb-2 text-slate-500" />
                        <p className="font-semibold text-sm">No records found for this filter.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {filteredList.map(record => {
                        const isRecPresent = ['Present', 'Late'].includes(record.status);
                        const isRecAbsent = ['Absent', 'Leave', 'Half Day'].includes(record.status);
                        return (
                          <div 
                            key={record.id || `${record.date}-${record.status}`} 
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border gap-3 transition-colors ${
                              isRecPresent 
                                ? 'bg-emerald-950/20 border-emerald-900/40 hover:bg-emerald-950/30' 
                                : 'bg-red-950/30 border-red-900/60 hover:bg-red-950/40'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg shrink-0 ${
                                isRecPresent ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'
                              }`}>
                                {isRecPresent ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-white text-base">
                                    {new Date(record.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                  </span>
                                  {isRecPresent && (
                                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/60">
                                      Teacher Verified
                                    </span>
                                  )}
                                </div>
                                {record.remarks && (
                                  <p className="text-xs text-slate-300 mt-0.5 font-medium">Remarks: {record.remarks}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={isRecPresent ? 'success' : 'danger'} 
                                className={`${isRecPresent ? 'bg-emerald-600' : 'bg-red-600'} text-white font-bold uppercase text-xs px-2.5 py-1`}
                              >
                                {record.status}
                              </Badge>
                              {isRecAbsent && (
                                <Button 
                                  onClick={() => { setActiveTab('notifications'); }} 
                                  size="sm"
                                  className="text-xs h-7 px-2.5 bg-red-700/60 hover:bg-red-700 text-white rounded-lg"
                                >
                                  View Alert →
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'test_exam_notices' && (
          <motion.div key="test_exam_notices" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StudentTestExamNotices
              studentId={currentStudentId}
              classId={classId}
              currentUser={profile}
            />
          </motion.div>
        )}

        {activeTab === 'notifications' && (
          <motion.div key="notifications" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="premium-card">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-slate-200">
                    <Bell className="text-brand-400" /> Alerts & Notifications
                  </h2>
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <Input 
                        type="text" 
                        placeholder="Search..." 
                        className="pl-9 h-10 w-full bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl"
                        value={notifSearch}
                        onChange={(e) => setNotifSearch(e.target.value)}
                      />
                    </div>
                    {notifications.length > 0 && (
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button onClick={handleMarkAllAsRead} variant="outline" size="sm" className="flex-1 sm:flex-none border-slate-800 text-slate-300 hover:bg-slate-800">
                          <CheckSquare size={16} className="sm:mr-2" /> <span className="hidden sm:inline">Mark All Read</span>
                        </Button>
                        <Button onClick={handleDeleteOldNotifications} variant="danger" size="sm" className="flex-1 sm:flex-none">
                          <Trash2 size={16} className="sm:mr-2" /> <span className="hidden sm:inline">Delete Read</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                {loading ? (
                  <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="text-center p-12 bg-slate-900/10 rounded-2xl border border-slate-800 border-dashed">
                    <div className="w-16 h-16 bg-emerald-950/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={32} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-300 mb-1">You're all caught up!</h3>
                    <p className="text-slate-400 text-sm max-w-md mx-auto">
                      {notifSearch ? 'No notifications match your search.' : 'No active absence alerts or notices. When marked absent by your teacher, daily absence alerts with acknowledgment options will appear here.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredNotifications.map((notification, idx) => {
                      const isAbsence = notification.type === 'absence_alert' || notification.type === 'attendance_absent';
                      const isPresent = notification.type === 'attendance_present';
                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                          key={notification.id} 
                          className={`p-5 rounded-2xl border transition-all ${
                            isAbsence
                              ? 'bg-red-950/40 border-l-4 border-l-red-500 border-red-900/60 shadow-xl'
                              : isPresent
                                ? 'bg-emerald-950/30 border-l-4 border-l-emerald-500 border-emerald-900/60 shadow-md'
                                : notification.is_read 
                                  ? 'bg-slate-900/30 border-slate-800/60' 
                                  : 'bg-brand-950/20 border-brand-900/40 shadow-md'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2 gap-4">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h3 className={`font-bold text-base tracking-tight ${
                                isAbsence 
                                  ? 'text-white' 
                                  : isPresent 
                                    ? 'text-emerald-300' 
                                    : notification.is_read ? 'text-slate-300' : 'text-brand-300'
                              }`}>
                                {notification.title}
                              </h3>
                              {isAbsence && (
                                <Badge variant="danger" className="bg-red-600 text-white font-black uppercase text-[11px] px-2 py-0.5 shadow-sm">
                                  {notification.status || 'Absent'}
                                </Badge>
                              )}
                              {isPresent && (
                                <Badge variant="success" className="bg-emerald-600 text-white font-black uppercase text-[11px] px-2 py-0.5 shadow-sm">
                                  {notification.status || 'Present'}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">
                              {new Date(notification.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="text-sm text-slate-200 mb-4 prose prose-invert prose-sm max-w-none leading-relaxed" dangerouslySetInnerHTML={{ __html: notification.message }} />
                          
                          <div className="flex flex-wrap gap-3 items-center">
                            {!notification.is_read && (
                              <button 
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
                              >
                                Mark as Read
                              </button>
                            )}
                            
                            {isAbsence && !notification.is_acknowledged ? (
                              <Button 
                                onClick={() => handleAcknowledge(notification.id)}
                                size="sm"
                                className="h-8 text-xs bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md"
                              >
                                <CheckCircle size={14} className="mr-1.5" /> Acknowledge Alert
                              </Button>
                            ) : isPresent && !notification.is_acknowledged ? (
                              <Button 
                                onClick={() => handleAcknowledge(notification.id)}
                                size="sm"
                                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md"
                              >
                                <CheckCircle size={14} className="mr-1.5" /> Confirm Attendance
                              </Button>
                            ) : notification.is_acknowledged ? (
                              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-900/40">
                                <CheckCircle size={14} /> Confirmed on {new Date(notification.acknowledged_at).toLocaleDateString()}
                              </span>
                            ) : null}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default StudentPortal;
