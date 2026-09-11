import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AttendanceVerificationService } from '../services/AttendanceVerificationService';
import { 
  Users, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  User, 
  Settings, 
  Save, 
  Edit, 
  X, 
  QrCode, 
  ShieldCheck, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  ExternalLink,
  MapPin,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const StaffAttendance = () => {
  const { profile } = useAuth();
  const [staffAttData, setStaffAttData] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [settings, setSettings] = useState({ reporting_time: '08:45', grace_mins: 10 });
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [editingRecord, setEditingRecord] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  // Active view: 'ATTENDANCE' | 'CORRECTIONS'
  const [activeTab, setActiveTab] = useState('ATTENDANCE');
  const [correctionRequests, setCorrectionRequests] = useState([]);
  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processingReview, setProcessingReview] = useState(false);
  const [campusesList, setCampusesList] = useState([]);
  const [campusFilter, setCampusFilter] = useState('ALL');

  useEffect(() => {
    fetchData();
    fetchCorrectionRequests();
  }, [dateFilter]);

  const fetchData = async () => {
    setLoading(true);
    // Fetch active teachers
    const { data: tData } = await supabase.from('profiles').select('*').eq('role', 'teacher').eq('status', 'Active');
    if (tData) setTeachers(tData);

    // Fetch settings
    const { data: sData } = await supabase.from('school_settings').select('*').in('setting_key', ['staff_reporting_time', 'staff_grace_period_mins']);
    if (sData) {
      let rTime = '08:45';
      let gMins = 10;
      sData.forEach(s => {
        if (s.setting_key === 'staff_reporting_time') rTime = s.setting_value;
        if (s.setting_key === 'staff_grace_period_mins') gMins = parseInt(s.setting_value) || 10;
      });
      setSettings({ reporting_time: rTime, grace_mins: gMins });
    }

    // Fetch campuses
    const { data: cData } = await supabase.from('campuses').select('*').order('campus_name');
    if (cData) setCampusesList(cData);

    // Fetch attendance for date with campus metadata
    const { data: aData } = await supabase
      .from('teacher_attendance')
      .select('*, campus:campus_id(id, campus_id, campus_name)')
      .eq('attendance_date', dateFilter);
    if (aData) setStaffAttData(aData);
    setLoading(false);
  };

  const fetchCorrectionRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_correction_requests')
        .select(`
          *,
          teacher:teacher_id (id, name, email)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setCorrectionRequests(data);
      }
    } catch (err) {
      console.warn('Could not fetch correction requests:', err);
    }
  };

  const saveSettings = async () => {
    await supabase.from('school_settings').upsert([
      { setting_key: 'staff_reporting_time', setting_value: settings.reporting_time, description: 'Standard reporting time for staff' },
      { setting_key: 'staff_grace_period_mins', setting_value: settings.grace_mins.toString(), description: 'Grace period allowed after reporting time before being marked Late' }
    ], { onConflict: 'setting_key' });
    setShowSettings(false);
    alert('Settings saved!');
  };

  const saveCorrection = async () => {
    if (!correctionReason) {
      alert("Please provide a reason for the correction.");
      return;
    }
    
    let recordId = editingRecord.record?.id;
    const oldStatus = editingRecord.record ? editingRecord.record.status : 'Absent';

    // Insert or Update teacher_attendance
    if (recordId) {
      const { error: updateError } = await supabase.from('teacher_attendance')
        .update({ 
          status: newStatus,
          check_in_method: 'MANUAL_CORRECTION',
          check_in_verification_status: 'VERIFIED'
        })
        .eq('id', recordId);
      if (updateError) { alert("Error updating: " + updateError.message); return; }
    } else {
      const { data: newRec, error: insertError } = await supabase.from('teacher_attendance')
        .insert([{
          teacher_id: editingRecord.teacher.id,
          attendance_date: dateFilter,
          status: newStatus,
          check_in_method: 'MANUAL_CORRECTION',
          check_in_verification_status: 'VERIFIED'
        }])
        .select()
        .single();
      if (insertError) { alert("Error inserting: " + insertError.message); return; }
      recordId = newRec.id;
    }

    // Insert into audit logs
    await supabase.from('attendance_audit_logs').insert([{
      record_id: recordId,
      modified_by: profile.id,
      original_status: oldStatus,
      new_status: newStatus,
      reason: correctionReason
    }]);

    setEditingRecord(null);
    setCorrectionReason('');
    fetchData(); // reload
  };

  const handleReviewDecision = async (requestId, decision) => {
    try {
      setProcessingReview(true);
      const res = await AttendanceVerificationService.reviewCorrectionRequest({
        requestId,
        decision,
        reviewerId: profile.id,
        adminNotes: adminNotes.trim()
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to process correction review');
      }

      alert(`Correction request ${decision === 'APPROVED' ? 'approved' : 'rejected'} successfully.`);
      setReviewingRequest(null);
      setAdminNotes('');
      fetchData();
      fetchCorrectionRequests();
    } catch (err) {
      alert("Error reviewing request: " + err.message);
    } finally {
      setProcessingReview(false);
    }
  };

  // KPIs
  const totalStaff = teachers.length;
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let leaveCount = 0;
  let missingCheckoutCount = 0;
  let verifiedCount = 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const isPastDate = dateFilter < todayStr;

  const feed = teachers.map(t => {
    const record = staffAttData.find(a => a.teacher_id === t.id);
    let status = 'Absent';
    let isMissingCheckout = false;

    if (record) {
      status = record.status;
      if (record.check_in_verification_status === 'VERIFIED') verifiedCount++;
      if (record.check_in_time && !record.check_out_time && (isPastDate || new Date().getHours() >= 17)) {
        isMissingCheckout = true;
        missingCheckoutCount++;
      }
    }
    
    if (status.includes('Present')) presentCount++;
    else if (status === 'Late') lateCount++;
    else if (status === 'Leave' || status === 'Medical Leave') leaveCount++;
    else absentCount++;

    return { teacher: t, record, status, isMissingCheckout };
  });

  const pendingCorrections = correctionRequests.filter(r => r.status === 'PENDING');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Users className="text-brand-500" /> Staff Attendance & Verification
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Verified Hybrid attendance tracking • Dynamic QR verification active
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin/attendance-qr?tab=campuses"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <MapPin size={15} /> Geofence (Lat/Long) <ExternalLink size={12} />
          </Link>

          <Link
            to="/admin/attendance-qr"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <QrCode size={17} /> Launch Live QR Kiosk <ExternalLink size={13} />
          </Link>

          <input 
            type="date" 
            className="input-field max-w-[170px]" 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
          />

          <select 
            className="input-field max-w-[180px]" 
            value={campusFilter} 
            onChange={(e) => setCampusFilter(e.target.value)}
          >
            <option value="ALL">All Campuses</option>
            {campusesList.map(c => (
              <option key={c.id} value={c.id}>{c.campus_name}</option>
            ))}
          </select>

          <button 
            className="btn-secondary flex items-center gap-2"
            onClick={() => setShowSettings(true)}
          >
            <Settings size={17} /> Rules
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="card text-center p-3.5">
          <div className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-1">Total Staff</div>
          <div className="text-2xl font-black text-[var(--text-primary)]">{totalStaff}</div>
        </div>
        <div className="card text-center p-3.5">
          <div className="text-emerald-500 text-xs font-semibold uppercase tracking-wider mb-1">Present</div>
          <div className="text-2xl font-black text-emerald-500">{presentCount}</div>
        </div>
        <div className="card text-center p-3.5">
          <div className="text-amber-500 text-xs font-semibold uppercase tracking-wider mb-1">Late</div>
          <div className="text-2xl font-black text-amber-500">{lateCount}</div>
        </div>
        <div className="card text-center p-3.5">
          <div className="text-rose-500 text-xs font-semibold uppercase tracking-wider mb-1">Absent</div>
          <div className="text-2xl font-black text-rose-500">{absentCount}</div>
        </div>
        <div className="card text-center p-3.5">
          <div className="text-purple-500 text-xs font-semibold uppercase tracking-wider mb-1">On Leave</div>
          <div className="text-2xl font-black text-purple-500">{leaveCount}</div>
        </div>
        <div className="card text-center p-3.5">
          <div className="text-blue-500 text-xs font-semibold uppercase tracking-wider mb-1">Verified QR</div>
          <div className="text-2xl font-black text-blue-500">{verifiedCount}</div>
        </div>
      </div>

      {/* Missing Checkout Alert Banner */}
      {missingCheckoutCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 p-4 rounded-xl flex items-center justify-between gap-3 text-amber-800 dark:text-amber-300 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle size={18} className="shrink-0 text-amber-500" />
            <span>
              <strong>{missingCheckoutCount} staff member(s)</strong> checked in but have no check-out recorded for this date.
            </span>
          </div>
          <span className="bg-amber-200/60 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 px-2.5 py-1 rounded-full font-bold uppercase text-[10px]">
            Action Required
          </span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('ATTENDANCE')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'ATTENDANCE'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Daily Attendance Roster
        </button>
        <button
          onClick={() => setActiveTab('CORRECTIONS')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'CORRECTIONS'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>Correction Requests</span>
          {pendingCorrections.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500 text-white font-black">
              {pendingCorrections.length}
            </span>
          )}
        </button>
      </div>

      {showSettings && (
        <div className="card border border-primary bg-primary/5 p-6 relative">
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Attendance Rules Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-sm font-bold text-[var(--text-secondary)] mb-1">Reporting Time (HH:MM)</label>
              <input type="time" className="input-field" value={settings.reporting_time} onChange={e => setSettings({...settings, reporting_time: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-bold text-[var(--text-secondary)] mb-1">Grace Period (Minutes)</label>
              <input type="number" min="0" className="input-field" value={settings.grace_mins} onChange={e => setSettings({...settings, grace_mins: parseInt(e.target.value) || 0})} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={saveSettings}><Save size={16} className="inline mr-2" /> Save Rules</button>
            <button className="btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'ATTENDANCE' ? (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Campus</th>
                <th>Status</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Hours</th>
                <th>Verification</th>
                <th>Method</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {feed
                .filter(f => {
                  if (campusFilter === 'ALL') return true;
                  return f.record?.campus_id === campusFilter;
                })
                .map(f => (
                <tr key={f.teacher.id}>
                  <td className="font-medium text-[var(--text-primary)]">{f.teacher.name}</td>
                  <td>
                    {f.record?.campus?.campus_name ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {f.record.campus.campus_name}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                  <td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase
                      ${f.status.includes('Present') ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400' : 
                        f.status === 'Late' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400' : 
                        f.status === 'Absent' ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400' : 
                        'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-400'}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="text-[var(--text-secondary)] font-mono text-xs">
                    {f.record?.check_in_time 
                      ? new Date(f.record.check_in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) 
                      : '-'}
                  </td>
                  <td className="text-[var(--text-secondary)] font-mono text-xs">
                    {f.record?.check_out_time ? (
                      new Date(f.record.check_out_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
                    ) : f.isMissingCheckout ? (
                      <span className="text-amber-500 font-bold text-[10px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        MISSING CHECKOUT
                      </span>
                    ) : f.record?.check_in_time ? (
                      <span className="text-slate-400 italic text-[11px]">In Progress</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="text-[var(--text-secondary)] font-mono text-xs font-bold">
                    {f.record?.working_hours || (
                      f.record?.check_in_time && f.record?.check_out_time
                        ? (() => {
                            const diff = new Date(f.record.check_out_time) - new Date(f.record.check_in_time);
                            const h = Math.floor(diff / 3600000);
                            const m = Math.floor((diff % 3600000) / 60000);
                            return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
                          })()
                        : '-'
                    )}
                  </td>
                  <td>
                    {f.record ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                        f.record.check_in_verification_status === 'VERIFIED'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : f.record.check_in_method === 'MANUAL_CORRECTION'
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                            : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30'
                      }`}>
                        <ShieldCheck size={12} />
                        {f.record.check_in_verification_status === 'VERIFIED'
                          ? 'Verified'
                          : f.record.check_in_method === 'MANUAL_CORRECTION'
                            ? 'Approved Correction'
                            : 'Unverified / Legacy'}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="text-xs text-[var(--text-secondary)]">
                    {f.record?.check_in_method === 'DYNAMIC_QR' ? (
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">Dynamic QR</span>
                    ) : f.record?.check_in_method === 'MANUAL_CORRECTION' ? (
                      <span className="font-medium text-blue-600 dark:text-blue-400">Manual / Admin</span>
                    ) : f.record ? (
                      <span className="text-slate-400">Direct / Legacy</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <button 
                      onClick={() => { setEditingRecord(f); setNewStatus(f.status); setCorrectionReason(''); }} 
                      className="text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 p-2 rounded-full transition-colors"
                      title="Direct Administrative Correction"
                    >
                      <Edit size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Correction Requests Review Tab */
        <div className="space-y-4">
          {correctionRequests.length === 0 ? (
            <div className="card p-12 text-center text-[var(--text-secondary)] text-sm">
              <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-500 opacity-60" />
              No pending attendance correction requests.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {correctionRequests.map((req) => (
                <div 
                  key={req.id} 
                  className={`card p-5 border flex flex-col justify-between transition-all ${
                    req.status === 'PENDING'
                      ? 'border-amber-400 dark:border-amber-500/40 bg-amber-500/5'
                      : req.status === 'APPROVED'
                        ? 'border-emerald-400/40 opacity-75'
                        : 'border-rose-400/40 opacity-75'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-base text-[var(--text-primary)]">
                          {req.teacher?.name || 'Teacher'}
                        </h4>
                        <p className="text-xs text-[var(--text-secondary)]">
                          Date: <strong className="text-[var(--text-primary)]">{req.attendance_date}</strong> • Category: <strong className="text-[var(--text-primary)]">{req.request_type}</strong>
                        </p>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        req.status === 'PENDING'
                          ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                          : req.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                      }`}>
                        {req.status}
                      </span>
                    </div>

                    <div className="bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                      <div className="text-[var(--text-secondary)]">
                        <strong>Reason:</strong> "{req.reason}"
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--text-secondary)] pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>Requested Status: <strong>{req.requested_status || 'Present'}</strong></span>
                        <span>Arrival: <strong>{req.requested_check_in_time || 'N/A'}</strong></span>
                        <span>Departure: <strong>{req.requested_check_out_time || 'N/A'}</strong></span>
                        <span>Submitted: <strong>{new Date(req.created_at).toLocaleDateString()}</strong></span>
                      </div>
                    </div>
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="pt-4 mt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setReviewingRequest(req);
                          setAdminNotes('');
                        }}
                        className="btn-primary text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700"
                      >
                        Review & Decide
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review Request Modal */}
      {reviewingRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-[var(--text-primary)]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-sm">Review Correction Request</h3>
              <button onClick={() => setReviewingRequest(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <span className="text-slate-400">Teacher:</span> <strong className="text-sm">{reviewingRequest.teacher?.name}</strong>
              </div>
              <div>
                <span className="text-slate-400">Date:</span> <strong>{reviewingRequest.attendance_date}</strong>
              </div>
              <div>
                <span className="text-slate-400">Reason Provided:</span>
                <p className="mt-1 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg italic">"{reviewingRequest.reason}"</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Administrative Notes (Optional)</label>
                <textarea
                  className="input-field w-full text-xs"
                  rows="2"
                  placeholder="e.g. Verified with teacher, morning assembly duty approved."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2">
              <button 
                disabled={processingReview}
                onClick={() => handleReviewDecision(reviewingRequest.id, 'REJECTED')}
                className="btn-secondary text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs py-2 px-3 flex items-center gap-1.5"
              >
                <XCircle size={15} /> Reject
              </button>
              <button 
                disabled={processingReview}
                onClick={() => handleReviewDecision(reviewingRequest.id, 'APPROVED')}
                className="btn-primary text-xs py-2 px-4 bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5"
              >
                <CheckCircle2 size={15} /> Approve Correction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Administrative Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Administrative Attendance Override</h3>
              <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">Teacher</p>
                <p className="font-bold">{editingRecord.teacher.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Current Status</p>
                  <p className="font-bold">{editingRecord.status}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">New Status</p>
                  <select className="input-field py-2" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                    <option value="Present">Present</option>
                    <option value="Present (Grace)">Present (Grace)</option>
                    <option value="Late">Late</option>
                    <option value="Absent">Absent</option>
                    <option value="Leave">Leave</option>
                    <option value="Medical Leave">Medical Leave</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Official Duty">Official Duty</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Audit Reason for Override *</label>
                <textarea 
                  className="input-field w-full" 
                  rows="3" 
                  placeholder="e.g. Authorized by Principal; medical certificate submitted..."
                  value={correctionReason}
                  onChange={e => setCorrectionReason(e.target.value)}
                ></textarea>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setEditingRecord(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveCorrection}>Save Override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffAttendance;
