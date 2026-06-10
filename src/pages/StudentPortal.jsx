import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, CheckCircle, Trash2, CheckSquare, Search, Calendar, Activity, Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const StudentPortal = () => {
  const { profile } = useAuth();
  const { students, featureAccess } = useData();
  const [activeTab, setActiveTab] = useState('overview');
  const [notifications, setNotifications] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Notification Management State
  const [notifSearch, setNotifSearch] = useState('');

  const studentData = students?.find(s => s.id === profile?.id || (profile?.uid && s.uid === profile?.uid) || (profile?.name && s.name === profile?.name));
  const classId = studentData?.class_id;

  const fetchNotifications = async () => {
    if (!studentData) return;
    const { data } = await supabase
      .from('student_notifications')
      .select('*')
      .eq('student_id', studentData.id)
      .neq('is_invalid', true)
      .order('created_at', { ascending: false });
    if (data) setNotifications(data);
    setLoading(false);
  };

  const fetchAttendanceHistory = async () => {
    if (!studentData) return;
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('student_id', studentData.id)
      .order('date', { ascending: false });
    if (data) setAttendanceRecords(data);
  };

  useEffect(() => {
    if (studentData) {
      fetchNotifications();
      fetchAttendanceHistory();
    }
  }, [studentData]);

  const handleMarkAsRead = async (notificationId) => {
    const { error } = await supabase
      .from('student_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);
      
    if (!error) {
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    
    const { error } = await supabase
      .from('student_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', unreadIds);
      
    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  const handleDeleteOldNotifications = async () => {
    // Delete notifications older than 30 days or all read notifications? Let's say all read notifications
    const readIds = notifications.filter(n => n.is_read).map(n => n.id);
    if (readIds.length === 0) return;

    const { error } = await supabase
      .from('student_notifications')
      .delete()
      .in('id', readIds);
      
    if (!error) {
      setNotifications(prev => prev.filter(n => !n.is_read));
    }
  };

  const handleAcknowledge = async (notificationId) => {
    const { error } = await supabase
      .from('student_notifications')
      .update({ is_acknowledged: true, acknowledged_at: new Date().toISOString(), is_read: true })
      .eq('id', notificationId);
      
    if (!error) {
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_acknowledged: true, is_read: true } : n));
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  
  const filteredNotifications = notifications.filter(n => 
    n.title.toLowerCase().includes(notifSearch.toLowerCase()) || 
    n.message.toLowerCase().includes(notifSearch.toLowerCase())
  );

  const isNotExpired = (expiresAt) => {
    if (!expiresAt) return true;
    return new Date() < new Date(expiresAt);
  };

  let isPythonEnabled = false;
  if (featureAccess && Array.isArray(featureAccess) && studentData) {
    const studentRule = featureAccess.find(f => f.feature_name === 'python_portal' && f.user_type === 'student' && f.student_id === studentData.id);
    const classRule = featureAccess.find(f => f.feature_name === 'python_portal' && f.user_type === 'class' && f.class_id === classId);

    if (studentRule) {
      isPythonEnabled = studentRule.is_enabled && isNotExpired(studentRule.expires_at);
    } else if (classRule) {
      isPythonEnabled = classRule.is_enabled && isNotExpired(classRule.expires_at);
    }
  }

  // Attendance Stats Calculation
  const totalDays = attendanceRecords.length;
  const presentDays = attendanceRecords.filter(r => ['Present', 'Late', 'Half Day'].includes(r.status)).length;
  const absentDays = attendanceRecords.filter(r => ['Absent', 'Leave'].includes(r.status)).length;
  const attendancePercentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : 0;
  
  const recentAbsences = attendanceRecords.filter(r => ['Absent', 'Leave'].includes(r.status)).slice(0, 5);

  const generateCertificate = () => {
    const certId = `CERT-${new Date().getTime().toString().slice(-6)}-${studentData?.roll_no || 'XX'}`;
    const generatedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    
    // Create an off-screen div for the certificate
    const certDiv = document.createElement('div');
    certDiv.style.padding = '40px';
    certDiv.style.fontFamily = 'Arial, sans-serif';
    certDiv.style.color = '#1e293b';
    certDiv.style.position = 'relative';
    certDiv.innerHTML = `
      <div style="border: 8px solid #0f172a; padding: 30px; text-align: center; background: white; position: relative;">
        <!-- Watermark / Background Logo -->
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
    
    html2pdf()
      .set({
        margin: 10,
        filename: `Attendance_Certificate_${studentData?.name.replace(/ /g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      })
      .from(certDiv)
      .save()
      .then(() => {
        document.body.removeChild(certDiv);
      });
  };

  return (
    <>
      <div className="portal-container" style={{ padding: '2rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Student Portal</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back, {profile?.name}</p>
        </header>

        <div className="flex gap-4 mb-6 border-b pb-2 flex-wrap">
          <button onClick={() => setActiveTab('overview')} className={`font-bold pb-2 ${activeTab === 'overview' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>Overview</button>
          <button onClick={() => setActiveTab('academics')} className={`font-bold pb-2 ${activeTab === 'academics' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>Academic Record</button>
          <button onClick={() => setActiveTab('attendance')} className={`font-bold pb-2 ${activeTab === 'attendance' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>Attendance History</button>
          <button onClick={() => setActiveTab('notifications')} className={`font-bold pb-2 flex items-center gap-2 ${activeTab === 'notifications' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>
            Alerts & Notifications
            {unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>}
          </button>
          {isPythonEnabled && (
            <a href="/python-student" className="font-bold pb-2 text-python-yellow hover:text-yellow-600 transition-colors flex items-center gap-2">
              Python Lab <ArrowRight size={16} />
            </a>
          )}
        </div>

        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <Link to="/study-materials" className="card" style={{ padding: '1.5rem', background: '#fff', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', textDecoration: 'none', color: 'inherit', display: 'block', border: '1px solid var(--border-color)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Study Materials</h2>
              <p style={{ color: 'var(--text-secondary)' }}>View and download materials uploaded by your teachers.</p>
            </Link>
            <Link to="/assignments" className="card" style={{ padding: '1.5rem', background: '#fff', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', textDecoration: 'none', color: 'inherit', display: 'block', border: '1px solid var(--border-color)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Assignments</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Submit your assignments and view teacher feedback.</p>
            </Link>
            <Link to="/result" className="card" style={{ padding: '1.5rem', background: '#fff', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', textDecoration: 'none', color: 'inherit', display: 'block', border: '1px solid var(--border-color)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>My Marks</h2>
              <p style={{ color: 'var(--text-secondary)' }}>View your report cards and exam results.</p>
            </Link>
          </div>
        )}

        {/* Attendance History Tab */}
        {activeTab === 'attendance' && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="text-primary" /> Attendance History
              </h2>
              <button onClick={generateCertificate} className="btn btn-primary flex items-center gap-2 shadow-sm">
                <Download size={18} /> Official Certificate
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-6 bg-white border border-slate-200 shadow-sm rounded-xl text-center">
                <p className="text-sm font-bold text-slate-500 uppercase">Overall Attendance</p>
                <h3 className={`text-4xl font-black mt-2 ${attendancePercentage >= 75 ? 'text-green-500' : 'text-red-500'}`}>{attendancePercentage}%</h3>
              </div>
              <div className="card p-6 bg-white border border-slate-200 shadow-sm rounded-xl text-center">
                <p className="text-sm font-bold text-slate-500 uppercase">Days Present</p>
                <h3 className="text-4xl font-black mt-2 text-slate-800">{presentDays}</h3>
              </div>
              <div className="card p-6 bg-white border border-slate-200 shadow-sm rounded-xl text-center">
                <p className="text-sm font-bold text-slate-500 uppercase">Days Absent</p>
                <h3 className="text-4xl font-black mt-2 text-red-500">{absentDays}</h3>
              </div>
            </div>

            <div className="card bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 border-b pb-2">
                <Activity size={18} className="text-primary" /> Recent Absences
              </h3>
              {recentAbsences.length === 0 ? (
                <p className="text-green-600 font-bold flex items-center gap-2">
                  <CheckCircle size={18} /> Great job! You have no recent absences.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {recentAbsences.map(record => (
                    <div key={record.id} className="flex justify-between p-3 bg-red-50 text-red-800 rounded-lg border border-red-100">
                      <span className="font-bold">{new Date(record.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      <span className="text-sm bg-red-200 px-2 py-1 rounded-full uppercase font-bold text-red-900">{record.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="card bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Bell className="text-primary" /> Alerts & Notifications
              </h2>
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search notifications..." 
                    className="input-field pl-9 py-2 w-full text-sm"
                    value={notifSearch}
                    onChange={(e) => setNotifSearch(e.target.value)}
                  />
                </div>
                {notifications.length > 0 && (
                  <>
                    <button onClick={handleMarkAllAsRead} className="btn btn-outline py-2 px-3 text-sm flex items-center gap-2" title="Mark All Read">
                      <CheckSquare size={16} /> <span className="hidden md:inline">Mark All Read</span>
                    </button>
                    <button onClick={handleDeleteOldNotifications} className="btn btn-outline py-2 px-3 text-sm flex items-center gap-2 text-red-500 border-red-200 hover:bg-red-50" title="Delete Read">
                      <Trash2 size={16} /> <span className="hidden md:inline">Delete Read</span>
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {loading ? (
              <p>Loading notifications...</p>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center p-8 text-gray-500 bg-slate-50 rounded-lg border border-slate-100">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
                <p>{notifSearch ? 'No notifications match your search.' : "You're all caught up! No notifications."}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredNotifications.map(notification => (
                  <div key={notification.id} className={`p-4 rounded-xl border ${notification.is_read ? 'bg-white border-slate-200 opacity-75' : 'bg-red-50 border-red-200 shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-bold ${notification.is_read ? 'text-slate-700' : 'text-red-800'}`}>
                        {notification.title}
                      </h3>
                      <span className="text-xs text-gray-400">{new Date(notification.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">{notification.message}</p>
                    
                    <div className="flex gap-3 items-center flex-wrap">
                      {!notification.is_read && (
                        <button 
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                        >
                          Mark as Read
                        </button>
                      )}
                      
                      {notification.type === 'absence_alert' && !notification.is_acknowledged ? (
                        <button 
                          onClick={() => handleAcknowledge(notification.id)}
                          className="btn btn-primary py-1 px-4 text-xs flex items-center gap-1"
                        >
                          <CheckCircle size={14} /> Acknowledge Alert
                        </button>
                      ) : notification.is_acknowledged ? (
                        <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded-full">
                          <CheckCircle size={14} /> Acknowledged on {new Date(notification.acknowledged_at).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
};

export default StudentPortal;
