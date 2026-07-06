import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, CheckCircle, Trash2, CheckSquare, Search, Calendar, Activity, Download, Book, FileText, Award, CreditCard } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { motion, AnimatePresence } from 'framer-motion';
import FeeDashboardView from '../components/FeeDashboardView';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';

const StudentPortal = () => {
  const { profile } = useAuth();
  const { students, featureAccess, classes } = useData();
  const [activeTab, setActiveTab] = useState('overview');
  const [notifications, setNotifications] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifSearch, setNotifSearch] = useState('');

  const studentData = students?.find(s => 
    s.id === profile?.id || 
    (profile?.uid && s.uid === profile?.uid) || 
    (profile?.name && s.name && s.name.trim().toLowerCase() === profile?.name.trim().toLowerCase())
  );
  const classId = studentData?.class_id;

  const fetchNotifications = async () => {
    if (!studentData) return;
    const { data: personalData } = await supabase.from('student_notifications').select('*').eq('student_id', studentData.id).neq('is_invalid', true);
    const { data: generalData } = await supabase.from('notices').select('*').in('target_audience', ['all', 'students']);
      
    const formattedGeneral = (generalData || []).map(n => ({
      id: n.id, title: n.title, message: n.content, type: 'general_notice', is_read: true, created_at: n.publish_date
    }));

    const combined = [...(personalData || []), ...formattedGeneral].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setNotifications(combined);
    setLoading(false);
  };

  const fetchAttendanceHistory = async () => {
    if (!studentData) return;
    const { data } = await supabase.from('attendance').select('*').eq('student_id', studentData.id).order('date', { ascending: false });
    if (data) setAttendanceRecords(data);
  };

  useEffect(() => {
    if (studentData) {
      fetchNotifications();
      fetchAttendanceHistory();
    }
  }, [studentData]);

  const handleMarkAsRead = async (notificationId) => {
    const { error } = await supabase.from('student_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', notificationId);
    if (!error) setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    const { error } = await supabase.from('student_notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', unreadIds);
    if (!error) setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleDeleteOldNotifications = async () => {
    const readIds = notifications.filter(n => n.is_read && n.type !== 'general_notice').map(n => n.id);
    if (readIds.length === 0) return;
    const { error } = await supabase.from('student_notifications').delete().in('id', readIds);
    if (!error) setNotifications(prev => prev.filter(n => !readIds.includes(n.id)));
  };

  const handleAcknowledge = async (notificationId) => {
    const { error } = await supabase.from('student_notifications').update({ is_acknowledged: true, acknowledged_at: new Date().toISOString(), is_read: true }).eq('id', notificationId);
    if (!error) setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_acknowledged: true, is_read: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const filteredNotifications = notifications.filter(n => n.title.toLowerCase().includes(notifSearch.toLowerCase()) || n.message.toLowerCase().includes(notifSearch.toLowerCase()));

  const isNotExpired = (expiresAt) => {
    if (!expiresAt) return true;
    return new Date() < new Date(expiresAt);
  };

  let isPythonEnabled = false;
  if (featureAccess && Array.isArray(featureAccess) && studentData) {
    const studentRule = featureAccess.find(f => f.feature_name === 'python_portal' && f.user_type === 'student' && f.student_id === studentData.id);
    const classRule = featureAccess.find(f => f.feature_name === 'python_portal' && f.user_type === 'class' && f.class_id === classId);
    if (studentRule) isPythonEnabled = studentRule.is_enabled && isNotExpired(studentRule.expires_at);
    else if (classRule) isPythonEnabled = classRule.is_enabled && isNotExpired(classRule.expires_at);
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
          This is to certify that <strong>${studentData?.name}</strong>, <br/>
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
    html2pdf().set({ margin: 10, filename: `Attendance_Certificate_${studentData?.name.replace(/ /g, '_')}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(certDiv).save().then(() => document.body.removeChild(certDiv));
  };

  const studentClass = classes?.find(c => c.id === classId);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Student Portal</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
          <p className="text-slate-500">Welcome back, <strong className="text-brand-600">{studentData?.name || profile?.name}</strong></p>
          {studentClass && (
            <Badge variant="primary" className="w-fit">
              Class {studentClass.name} {studentClass.section || ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto custom-scrollbar border-b border-slate-200 hide-scrollbar pb-2">
        <div className="flex gap-2 sm:gap-6 min-w-max">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'fees', label: 'My Fees' },
            { id: 'attendance', label: 'Attendance' },
            { id: 'notifications', label: 'Alerts', badge: unreadCount > 0 ? unreadCount : null }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-3 px-1 text-sm sm:text-base font-semibold transition-colors flex items-center gap-2 ${activeTab === tab.id ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {tab.label}
              {tab.badge && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{tab.badge}</span>}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
              )}
            </button>
          ))}
          {isPythonEnabled && (
            <a href="/python-student" className="pb-3 px-1 text-sm sm:text-base font-bold text-indigo-500 hover:text-indigo-700 transition-colors flex items-center gap-1.5 ml-auto sm:ml-0">
              Python Lab <ArrowRight size={14} />
            </a>
          )}
        </div>
      </div>

      {/* Overview Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link to="/study-materials">
              <Card hoverable className="h-full border-t-4 border-t-brand-500 group">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Book size={24} />
                  </div>
                  <h3 className="font-bold text-xl mb-2 text-slate-800 group-hover:text-brand-600 transition-colors">Study Materials</h3>
                  <p className="text-slate-500 text-sm flex-1">View and download materials uploaded by your teachers.</p>
                  <ArrowRight size={20} className="text-brand-300 group-hover:text-brand-600 transition-colors mt-4 self-end" />
                </CardContent>
              </Card>
            </Link>
            
            <Link to="/assignments">
              <Card hoverable className="h-full border-t-4 border-t-amber-500 group">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <FileText size={24} />
                  </div>
                  <h3 className="font-bold text-xl mb-2 text-slate-800 group-hover:text-amber-500 transition-colors">Assignments</h3>
                  <p className="text-slate-500 text-sm flex-1">Submit your assignments and view teacher feedback.</p>
                  <ArrowRight size={20} className="text-amber-300 group-hover:text-amber-500 transition-colors mt-4 self-end" />
                </CardContent>
              </Card>
            </Link>

            <Link to="/result">
              <Card hoverable className="h-full border-t-4 border-t-emerald-500 group">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Award size={24} />
                  </div>
                  <h3 className="font-bold text-xl mb-2 text-slate-800 group-hover:text-emerald-500 transition-colors">My Marks</h3>
                  <p className="text-slate-500 text-sm flex-1">View your report cards and exam results.</p>
                  <ArrowRight size={20} className="text-emerald-300 group-hover:text-emerald-500 transition-colors mt-4 self-end" />
                </CardContent>
              </Card>
            </Link>
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
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                <Calendar className="text-brand-500" /> Attendance History
              </h2>
              <Button onClick={generateCertificate} variant="primary" className="flex items-center gap-2 w-full sm:w-auto">
                <Download size={18} /> Official Certificate
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-brand-50 to-indigo-50 border-brand-100 text-center">
                <CardContent className="p-6">
                  <p className="text-xs font-bold text-brand-600/70 uppercase tracking-wider mb-2">Overall Attendance</p>
                  <h3 className={`text-5xl font-black ${attendancePercentage >= 75 ? 'text-emerald-500' : 'text-red-500'}`}>{attendancePercentage}%</h3>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-6">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Days Present</p>
                  <h3 className="text-5xl font-black text-slate-800">{presentDays}</h3>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-6">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Days Absent</p>
                  <h3 className="text-5xl font-black text-red-500">{absentDays}</h3>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Activity size={18} className="text-brand-500" /> Recent Absences
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {recentAbsences.length === 0 ? (
                  <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center gap-3">
                    <CheckCircle size={20} className="text-emerald-500" />
                    <p className="font-medium text-sm">Great job! You have no recent absences.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentAbsences.map(record => (
                      <div key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100 gap-2">
                        <span className="font-semibold text-red-900">{new Date(record.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        <Badge variant="danger" className="w-fit">{record.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <motion.div key="notifications" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                    <Bell className="text-brand-500" /> Alerts & Notifications
                  </h2>
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input 
                        type="text" 
                        placeholder="Search..." 
                        className="pl-9 h-10 w-full"
                        value={notifSearch}
                        onChange={(e) => setNotifSearch(e.target.value)}
                      />
                    </div>
                    {notifications.length > 0 && (
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button onClick={handleMarkAllAsRead} variant="outline" size="sm" className="flex-1 sm:flex-none">
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
                  <div className="text-center p-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={32} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-700 mb-1">You're all caught up!</h3>
                    <p className="text-slate-500 text-sm">{notifSearch ? 'No notifications match your search.' : "No new alerts or messages."}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredNotifications.map((notification, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                        key={notification.id} 
                        className={`p-5 rounded-2xl border transition-all ${notification.is_read ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200 shadow-sm'}`}
                      >
                        <div className="flex justify-between items-start mb-2 gap-4">
                          <h3 className={`font-bold ${notification.is_read ? 'text-slate-700' : 'text-red-900'}`}>
                            {notification.title}
                          </h3>
                          <span className="text-xs font-medium text-slate-400 whitespace-nowrap">{new Date(notification.created_at).toLocaleString()}</span>
                        </div>
                        <div className="text-sm text-slate-600 mb-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: notification.message }} />
                        
                        <div className="flex flex-wrap gap-3 items-center">
                          {!notification.is_read && (
                            <button 
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                            >
                              Mark as Read
                            </button>
                          )}
                          
                          {notification.type === 'absence_alert' && !notification.is_acknowledged ? (
                            <Button 
                              onClick={() => handleAcknowledge(notification.id)}
                              size="sm"
                              className="h-8 text-xs"
                            >
                              <CheckCircle size={14} className="mr-1.5" /> Acknowledge Alert
                            </Button>
                          ) : notification.is_acknowledged ? (
                            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 bg-emerald-100/50 px-3 py-1.5 rounded-lg border border-emerald-200/50">
                              <CheckCircle size={14} /> Acknowledged on {new Date(notification.acknowledged_at).toLocaleDateString()}
                            </span>
                          ) : null}
                        </div>
                      </motion.div>
                    ))}
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
