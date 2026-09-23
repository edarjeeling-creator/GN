import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AttendanceVerificationService, STAFF_ATTENDANCE_ROLES } from '../services/AttendanceVerificationService';
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
  HelpCircle,
  Search,
  Filter,
  Zap,
  Building2
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
  const [correctionCheckInTime, setCorrectionCheckInTime] = useState('08:30');

  // Campus-Specific Attendance Rules State
  const [campusRules, setCampusRules] = useState([]);
  const [editingCampusRule, setEditingCampusRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    campusId: '',
    schoolStartTime: '08:15',
    gracePeriodMinutes: 10,
    effectiveFrom: new Date().toISOString().split('T')[0],
    reason: ''
  });
  const [savingRule, setSavingRule] = useState(false);

  // Active view: 'ATTENDANCE' | 'CORRECTIONS'
  const [activeTab, setActiveTab] = useState('ATTENDANCE');
  const [correctionRequests, setCorrectionRequests] = useState([]);
  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processingReview, setProcessingReview] = useState(false);
  const [campusesList, setCampusesList] = useState([]);
  const [campusFilter, setCampusFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // One-Click Bulk Attendance Modal State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCampusSlug, setBulkCampusSlug] = useState('SENIOR_SCHOOL'); // 'SENIOR_SCHOOL' | 'JUNIOR_SCHOOL'
  const [bulkCheckInTime, setBulkCheckInTime] = useState('08:15');
  const [bulkSelectedTeacherIds, setBulkSelectedTeacherIds] = useState([]);
  const [bulkReason, setBulkReason] = useState('System timing error: teachers arrived on time before 8:25 AM');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');
  const [bulkFeedback, setBulkFeedback] = useState(null);


  const computeLateThreshold = (startTime, graceMins) => {
    if (!startTime) return '--:--';
    const [h, m] = startTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '--:--';
    const totalMins = h * 60 + m + (Number(graceMins) || 0);
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
  };

  const formatTime12 = (timeStr) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
  };

  const getRuleForCampus = (campusIdOrSlug) => {
    const found = campusRules.find(r => 
      (r.campus_id === campusIdOrSlug || r.campus_slug === campusIdOrSlug) && r.active
    );
    if (found) return found;

    if (campusIdOrSlug === 'JUNIOR_SCHOOL' || campusIdOrSlug?.toLowerCase()?.includes('junior')) {
      return {
        campus_name: 'Junior School',
        school_start_time: '08:40:00',
        grace_period_minutes: 10,
        late_threshold: '08:50:00'
      };
    }
    return {
      campus_name: 'Senior School',
      school_start_time: '08:15:00',
      grace_period_minutes: 10,
      late_threshold: '08:25:00'
    };
  };

  useEffect(() => {
    fetchData();
    fetchCorrectionRequests();
  }, [dateFilter]);

  const fetchData = async () => {
    setLoading(true);
    // Fetch active staff across all authoritative roles
    const { data: tData } = await supabase.from('profiles').select('*').in('role', STAFF_ATTENDANCE_ROLES).eq('status', 'Active');
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

    // Fetch campus attendance rules
    try {
      const rules = await AttendanceVerificationService.getCampusAttendanceRules();
      if (rules && rules.length > 0) {
        setCampusRules(rules);
      }
    } catch (err) {
      console.warn('Could not fetch campus attendance rules:', err);
    }

    // Fetch attendance for date with campus metadata
    const { data: aData } = await supabase
      .from('teacher_attendance')
      .select('*, campus:campus_id(id, campus_id, campus_name)')
      .eq('attendance_date', dateFilter);
    if (aData) setStaffAttData(aData);
    setLoading(false);
  };

  const handleSaveCampusRule = async (campusId) => {
    if (!ruleForm.reason || !ruleForm.reason.trim()) {
      alert('Please provide an audit reason for modifying the attendance timing rule.');
      return;
    }
    setSavingRule(true);
    try {
      await AttendanceVerificationService.updateCampusAttendanceRule({
        campusId: campusId || ruleForm.campusId,
        schoolStartTime: ruleForm.schoolStartTime,
        gracePeriodMinutes: ruleForm.gracePeriodMinutes,
        effectiveFrom: ruleForm.effectiveFrom,
        reason: ruleForm.reason.trim()
      });
      alert('Campus attendance rule saved and audited successfully!');
      setEditingCampusRule(null);
      fetchData();
    } catch (err) {
      alert('Error saving rule: ' + err.message);
    } finally {
      setSavingRule(false);
    }
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

  const handleStartEdit = (f) => {
    setEditingRecord(f);
    setNewStatus(f.status);
    setCorrectionReason('');
    if (f.record?.check_in_time) {
      try {
        const d = new Date(f.record.check_in_time);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        setCorrectionCheckInTime(`${hh}:${mm}`);
      } catch {
        setCorrectionCheckInTime(settings.reporting_time || '08:30');
      }
    } else {
      setCorrectionCheckInTime(settings.reporting_time || '08:30');
    }
  };

  const saveCorrection = async () => {
    if (!correctionReason.trim()) {
      alert("Please provide a reason for the correction.");
      return;
    }

    let checkInTimestamptz = null;
    if (newStatus !== 'Absent') {
      if (!correctionCheckInTime) {
        alert("Please specify a Check-In Arrival Time so the staff member is eligible for afternoon checkout.");
        return;
      }
      const timeClean = correctionCheckInTime.length === 5 ? `${correctionCheckInTime}:00` : correctionCheckInTime;
      checkInTimestamptz = `${dateFilter}T${timeClean}+05:30`;
    }
    
    let recordId = editingRecord.record?.id;
    const oldStatus = editingRecord.record ? editingRecord.record.status : 'Absent';

    // Insert or Update teacher_attendance
    if (recordId) {
      const updatePayload = { 
        status: newStatus,
        check_in_method: 'MANUAL_CORRECTION',
        check_in_verification_status: newStatus === 'Absent' ? 'UNVERIFIED' : 'ADMIN_VERIFIED', // Truthful audit distinction
        updated_at: new Date().toISOString()
      };
      // Populate check_in_time if missing or newly required for afternoon checkout
      if (checkInTimestamptz && !editingRecord.record?.check_in_time) {
        updatePayload.check_in_time = checkInTimestamptz;
      }
      const { error: updateError } = await supabase.from('teacher_attendance')
        .update(updatePayload)
        .eq('id', recordId);
      if (updateError) { alert("Error updating: " + updateError.message); return; }
    } else {
      const { data: newRec, error: insertError } = await supabase.from('teacher_attendance')
        .insert([{
          teacher_id: editingRecord.teacher.id,
          attendance_date: dateFilter,
          status: newStatus,
          check_in_time: checkInTimestamptz,
          check_in_method: 'MANUAL_CORRECTION',
          check_in_verification_status: newStatus === 'Absent' ? 'UNVERIFIED' : 'ADMIN_VERIFIED'
        }])
        .select()
        .single();
      if (insertError) { alert("Error inserting: " + insertError.message); return; }
      recordId = newRec.id;
    }

    // Insert into audit logs
    await supabase.from('attendance_audit_logs').insert([{
      record_id: recordId,
      modified_by: profile?.id || null,
      original_status: oldStatus,
      new_status: newStatus,
      reason: `Administrative manual override: ${correctionReason.trim()}${checkInTimestamptz ? ` (Arrival: ${correctionCheckInTime})` : ''}`
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

  // --- One-Click Emergency Attendance Helpers ---
  const isJuniorTeacher = (teacher) => {
    if (!teacher) return false;
    const c = (teacher.campus || '').toLowerCase();
    const cid = teacher.campus_id || '';
    const assignedClass = String(teacher.class_assigned || teacher.assigned_class || '').toLowerCase();
    const juniorCampusObj = campusesList.find(camp => camp.campus_id === 'JUNIOR_SCHOOL');
    if (juniorCampusObj && (cid === juniorCampusObj.id || cid === juniorCampusObj.campus_id)) return true;
    if (cid === 'JUNIOR_SCHOOL' || c.includes('junior')) return true;
    if (['nursery', 'lkg', 'ukg', '1', '2', '3', '4', '5'].some(cls => assignedClass === cls || assignedClass.startsWith(cls + ' '))) return true;
    return false;
  };

  const getTeachersForBulkCampus = (targetSlug) => {
    return teachers.filter(t => {
      const isJr = isJuniorTeacher(t);
      return targetSlug === 'JUNIOR_SCHOOL' ? isJr : !isJr;
    });
  };

  const openBulkModal = (targetCampusSlug = 'SENIOR_SCHOOL') => {
    setBulkCampusSlug(targetCampusSlug);
    const defaultTime = targetCampusSlug === 'JUNIOR_SCHOOL' ? '08:20' : '08:15';
    setBulkCheckInTime(defaultTime);
    setBulkReason('System timing error: teachers arrived on time before 8:25 AM');
    setBulkFeedback(null);
    setBulkSearchQuery('');

    const targetTeachers = getTeachersForBulkCampus(targetCampusSlug);
    setBulkSelectedTeacherIds(targetTeachers.map(t => t.id));
    setShowBulkModal(true);
  };

  const handleSwitchBulkCampus = (targetSlug) => {
    setBulkCampusSlug(targetSlug);
    setBulkCheckInTime(targetSlug === 'JUNIOR_SCHOOL' ? '08:20' : '08:15');
    setBulkFeedback(null);
    const targetTeachers = getTeachersForBulkCampus(targetSlug);
    setBulkSelectedTeacherIds(targetTeachers.map(t => t.id));
  };

  const toggleBulkTeacher = (id) => {
    setBulkSelectedTeacherIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllBulk = (list) => {
    const listIds = list.map(t => t.id);
    setBulkSelectedTeacherIds(Array.from(new Set([...bulkSelectedTeacherIds, ...listIds])));
  };

  const handleDeselectAllBulk = (list) => {
    const listIds = new Set(list.map(t => t.id));
    setBulkSelectedTeacherIds(prev => prev.filter(id => !listIds.has(id)));
  };

  const getTeacherCurrentStatus = (teacherId) => {
    const record = staffAttData.find(a => a.teacher_id === teacherId);
    return record?.status || 'Absent';
  };

  const handleExecuteBulkMarkPresent = async () => {
    if (bulkSelectedTeacherIds.length === 0) {
      alert('Please select at least one teacher to mark Present.');
      return;
    }

    try {
      setIsProcessingBulk(true);
      setBulkFeedback(null);

      // Find campus ID
      const targetCampusObj = campusesList.find(c => c.campus_id === bulkCampusSlug);
      const targetCampusId = targetCampusObj?.id || (bulkCampusSlug === 'JUNIOR_SCHOOL' ? 'f588c989-9ce5-4b17-b1af-d02892e66962' : '527e7cc9-2af1-4d47-995f-8d54a08c72a2');

      const res = await AttendanceVerificationService.bulkMarkPresent({
        campusId: targetCampusId,
        attendanceDate: dateFilter,
        checkInTime: bulkCheckInTime,
        teacherIds: bulkSelectedTeacherIds,
        reason: bulkReason
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to bulk mark attendance');
      }

      setBulkFeedback({
        type: 'success',
        message: `Successfully marked ${res.count || bulkSelectedTeacherIds.length} teachers Present for ${bulkCampusSlug === 'JUNIOR_SCHOOL' ? 'Junior School' : 'Senior School'} at ${formatTime12(bulkCheckInTime)} on ${dateFilter}!`
      });

      await fetchData();
    } catch (err) {
      console.error('Error executing bulk mark present:', err);
      setBulkFeedback({
        type: 'error',
        message: err.message || 'Error executing bulk mark present.'
      });
    } finally {
      setIsProcessingBulk(false);
    }
  };


  // Look up selected campus name
  const selectedCampusObj = campusesList.find(c => c.id === campusFilter);
  const selectedCampusName = selectedCampusObj?.campus_name || '';

  const teacherMatchesCampus = (teacher, record) => {
    if (campusFilter === 'ALL') return true;

    // 1. If teacher checked in today at this campus
    if (record?.campus_id === campusFilter) return true;
    if (record?.campus?.campus_name && selectedCampusName &&
        record.campus.campus_name.toLowerCase() === selectedCampusName.toLowerCase()) {
      return true;
    }

    // 2. If no attendance record, check profile campus assignment
    if (!record || !record.campus_id) {
      if (teacher?.campus_id === campusFilter) return true;
      if (teacher?.campus) {
        if (teacher.campus === 'All Campuses') return true;
        if (selectedCampusName && teacher.campus.toLowerCase() === selectedCampusName.toLowerCase()) {
          return true;
        }
      }
    }

    return false;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const isPastDate = dateFilter < todayStr;

  // Single authoritative feed scoped to current campus
  const scopedStaff = teachers
    .map(t => {
      const record = staffAttData.find(a => a.teacher_id === t.id);
      let status = 'Absent';
      let isMissingCheckout = false;

      if (record) {
        status = record.status;
        if (record.check_in_time && !record.check_out_time && (isPastDate || new Date().getHours() >= 17)) {
          isMissingCheckout = true;
        }
      }

      // Dynamic QR check: verification method must be DYNAMIC_QR and verification status VERIFIED
      const isVerifiedQR = Boolean(
        record &&
        (record.check_in_method === 'DYNAMIC_QR' || record.check_out_method === 'DYNAMIC_QR') &&
        (record.check_in_verification_status === 'VERIFIED' || record.check_out_verification_status === 'VERIFIED')
      );

      return { teacher: t, record, status, isMissingCheckout, isVerifiedQR };
    })
    .filter(item => teacherMatchesCampus(item.teacher, item.record));

  // Authoritative KPI counts derived directly from scoped dataset
  const totalStaff = scopedStaff.length;
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let leaveCount = 0;
  let missingCheckoutCount = 0;
  let verifiedCount = 0;

  scopedStaff.forEach(item => {
    if (item.status.includes('Present')) presentCount++;
    else if (item.status === 'Late') lateCount++;
    else if (item.status === 'Leave' || item.status === 'Medical Leave' || item.status.toLowerCase().includes('leave')) leaveCount++;
    else absentCount++;

    if (item.isMissingCheckout) missingCheckoutCount++;
    if (item.isVerifiedQR) verifiedCount++;
  });

  // Filter roster by selectedStatusFilter
  const statusFilteredStaff = scopedStaff.filter(item => {
    switch (selectedStatusFilter) {
      case 'PRESENT':
        return item.status.includes('Present');
      case 'LATE':
        return item.status === 'Late';
      case 'ABSENT':
        return item.status === 'Absent';
      case 'ON_LEAVE':
        return item.status === 'Leave' || item.status === 'Medical Leave' || item.status.toLowerCase().includes('leave');
      case 'VERIFIED_QR':
        return item.isVerifiedQR;
      case 'ALL':
      default:
        return true;
    }
  });

  // Filter roster by search query
  const displayedStaff = statusFilteredStaff.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = item.teacher.name?.toLowerCase().includes(q);
    const campusNameMatch = (item.record?.campus?.campus_name || item.teacher?.campus || '').toLowerCase().includes(q);
    return nameMatch || campusNameMatch;
  });

  const filterCards = [
    {
      id: 'ALL',
      label: 'Total Staff',
      count: totalStaff,
      color: 'text-[var(--text-primary)]',
      activeBorder: 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/30',
      activeBadge: 'bg-brand-500 text-white',
      ariaLabel: `Filter staff attendance by Total Staff. ${totalStaff} staff.`
    },
    {
      id: 'PRESENT',
      label: 'Present',
      count: presentCount,
      color: 'text-emerald-500',
      activeBorder: 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30',
      activeBadge: 'bg-emerald-500 text-white',
      ariaLabel: `Filter staff attendance by Present. ${presentCount} staff.`
    },
    {
      id: 'LATE',
      label: 'Late',
      count: lateCount,
      color: 'text-amber-500',
      activeBorder: 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30',
      activeBadge: 'bg-amber-500 text-white',
      ariaLabel: `Filter staff attendance by Late. ${lateCount} staff.`
    },
    {
      id: 'ABSENT',
      label: 'Absent',
      count: absentCount,
      color: 'text-rose-500',
      activeBorder: 'border-rose-500 bg-rose-500/10 ring-2 ring-rose-500/30',
      activeBadge: 'bg-rose-500 text-white',
      ariaLabel: `Filter staff attendance by Absent. ${absentCount} staff.`
    },
    {
      id: 'ON_LEAVE',
      label: 'On Leave',
      count: leaveCount,
      color: 'text-purple-500',
      activeBorder: 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/30',
      activeBadge: 'bg-purple-500 text-white',
      ariaLabel: `Filter staff attendance by On Leave. ${leaveCount} staff.`
    },
    {
      id: 'VERIFIED_QR',
      label: 'Verified QR',
      count: verifiedCount,
      color: 'text-blue-500',
      activeBorder: 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30',
      activeBadge: 'bg-blue-500 text-white',
      ariaLabel: `Filter staff attendance by Verified QR. ${verifiedCount} staff.`
    }
  ];

  const pendingCorrections = correctionRequests.filter(r => r.status === 'PENDING');

  const bulkTeachersList = getTeachersForBulkCampus(bulkCampusSlug);
  const filteredBulkTeachers = bulkTeachersList.filter(t => {
    if (!bulkSearchQuery.trim()) return true;
    const q = bulkSearchQuery.toLowerCase();
    return (
      (t.name || '').toLowerCase().includes(q) ||
      (t.email || '').toLowerCase().includes(q) ||
      (t.id || '').toLowerCase().includes(q)
    );
  });

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

          {profile?.role && ['admin', 'principal', 'coordinator'].includes(profile.role) && (
            <button 
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => openBulkModal('SENIOR_SCHOOL')}
              title="One-Click Attendance: Mark Senior or Junior teachers Present before 8:25 AM"
            >
              <Zap size={16} className="fill-slate-950 text-slate-950" />
              <span>One-Click Present</span>
            </button>
          )}
        </div>
      </div>


      {/* Authoritative Campus Timing Rule Display (Section 24) */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 px-3.5 bg-slate-900/60 border border-slate-700/60 rounded-xl text-xs text-slate-300">
        <div className="flex items-center gap-1.5 font-bold text-slate-400">
          <Clock size={14} className="text-brand-400" />
          <span>Timing Rules:</span>
        </div>

        {(campusFilter === 'ALL' || campusFilter === 'SENIOR_SCHOOL' || campusesList.find(c => c.id === campusFilter)?.campus_id === 'SENIOR_SCHOOL') && (
          <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-bold text-emerald-400">Senior School:</span>
            <span className="text-slate-300">Start <strong>8:15 AM</strong> • Grace <strong>10 min</strong> • Late after <strong className="text-amber-400">8:25 AM</strong></span>
          </div>
        )}

        {(campusFilter === 'ALL' || campusFilter === 'JUNIOR_SCHOOL' || campusesList.find(c => c.id === campusFilter)?.campus_id === 'JUNIOR_SCHOOL') && (
          <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="font-bold text-blue-400">Junior School:</span>
            <span className="text-slate-300">Start <strong>8:40 AM</strong> • Grace <strong>10 min</strong> • Late after <strong className="text-amber-400">8:50 AM</strong></span>
          </div>
        )}
      </div>

      {/* Primary Interactive KPI Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {filterCards.map(card => {
          const isActive = selectedStatusFilter === card.id;
          return (
            <button
              key={card.id}
              type="button"
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              aria-label={card.ariaLabel}
              onClick={() => setSelectedStatusFilter(card.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedStatusFilter(card.id);
                }
              }}
              className={`card text-center p-3.5 cursor-pointer transition-all duration-150 relative select-none text-left sm:text-center focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                isActive
                  ? `${card.activeBorder} shadow-md -translate-y-0.5`
                  : 'hover:border-slate-400 dark:hover:border-slate-600 hover:-translate-y-0.5 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between sm:justify-center mb-1">
                <span className={`${card.color} text-xs font-semibold uppercase tracking-wider`}>
                  {card.label}
                </span>
                {isActive && (
                  <span className={`sm:hidden text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${card.activeBadge}`}>
                    Active
                  </span>
                )}
              </div>
              <div className={`text-2xl font-black ${card.color}`}>{card.count}</div>
              {isActive && (
                <div className="hidden sm:flex items-center justify-center gap-1 mt-1 text-[10px] font-bold uppercase tracking-wider opacity-90">
                  <span className="w-1.5 h-1.5 rounded-full bg-current inline-block animate-pulse" /> Active Filter
                </div>
              )}
            </button>
          );
        })}
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
        <div className="card border border-brand-500/30 bg-slate-900/90 backdrop-blur-md p-6 relative rounded-2xl shadow-2xl text-[var(--text-primary)] space-y-6">
          <div className="flex justify-between items-start border-b border-slate-700/60 pb-4">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                <Settings className="text-brand-400" size={20} /> Campus Attendance Timing Rules
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Authoritative campus-specific start times and grace periods • Exact boundary enforcement
              </p>
            </div>
            <button 
              onClick={() => { setShowSettings(false); setEditingCampusRule(null); }}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Senior School Card */}
            {(() => {
              const seniorCampus = campusesList.find(c => c.campus_id === 'SENIOR_SCHOOL') || { id: 'SENIOR_SCHOOL', campus_name: 'Senior School' };
              const seniorRule = getRuleForCampus('SENIOR_SCHOOL');
              const isEditing = editingCampusRule === seniorCampus.id || editingCampusRule === 'SENIOR_SCHOOL';

              return (
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <h4 className="font-bold text-sm text-white">Senior School</h4>
                    </div>
                    {profile?.role && ['admin', 'principal'].includes(profile.role) && !isEditing && (
                      <button
                        onClick={() => {
                          setEditingCampusRule(seniorCampus.id);
                          setRuleForm({
                            campusId: seniorCampus.id,
                            schoolStartTime: seniorRule.school_start_time?.slice(0, 5) || '08:15',
                            gracePeriodMinutes: seniorRule.grace_period_minutes ?? 10,
                            effectiveFrom: new Date().toISOString().split('T')[0],
                            reason: ''
                          });
                        }}
                        className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold"
                      >
                        <Edit size={13} /> Edit Rule
                      </button>
                    )}
                  </div>

                  {!isEditing ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-700/40">
                        <span className="text-slate-400">School Start Time:</span>
                        <strong className="text-slate-200 font-mono text-sm">{formatTime12(seniorRule.school_start_time)}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-700/40">
                        <span className="text-slate-400">Grace Period:</span>
                        <strong className="text-slate-200">{seniorRule.grace_period_minutes} minutes</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-700/40">
                        <span className="text-slate-400">Late Threshold:</span>
                        <strong className="text-amber-400 font-mono text-sm">{formatTime12(seniorRule.late_threshold)}</strong>
                      </div>
                      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[11px] text-emerald-300">
                        ✓ Check-in at or before <strong>{seniorRule.late_threshold?.slice(0, 5) || '08:25'}</strong> → <strong>PRESENT</strong><br />
                        ⚠ Check-in after <strong>{seniorRule.late_threshold?.slice(0, 5) || '08:25'}:00</strong> → <strong>LATE</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2 text-xs">
                      <div>
                        <label className="block text-slate-400 font-medium mb-1">School Start Time (HH:MM)</label>
                        <input
                          type="time"
                          className="input-field w-full text-xs"
                          value={ruleForm.schoolStartTime}
                          onChange={e => setRuleForm({ ...ruleForm, schoolStartTime: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-medium mb-1">Grace Period (Minutes)</label>
                        <input
                          type="number"
                          min="0"
                          className="input-field w-full text-xs"
                          value={ruleForm.gracePeriodMinutes}
                          onChange={e => setRuleForm({ ...ruleForm, gracePeriodMinutes: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="p-2 bg-slate-900/60 rounded-lg text-slate-300">
                        Computed Late Threshold: <strong className="text-amber-400 font-mono">{formatTime12(computeLateThreshold(ruleForm.schoolStartTime, ruleForm.gracePeriodMinutes))}</strong>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-medium mb-1">Effective From Date</label>
                        <input
                          type="date"
                          className="input-field w-full text-xs"
                          value={ruleForm.effectiveFrom}
                          onChange={e => setRuleForm({ ...ruleForm, effectiveFrom: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-medium mb-1">Audit Reason for Change *</label>
                        <textarea
                          rows="2"
                          className="input-field w-full text-xs"
                          placeholder="e.g. Approved start time adjustment for academic term..."
                          value={ruleForm.reason}
                          onChange={e => setRuleForm({ ...ruleForm, reason: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <button
                          type="button"
                          className="btn-secondary text-xs py-1.5 px-3"
                          onClick={() => setEditingCampusRule(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingRule}
                          className="btn-primary text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleSaveCampusRule(seniorCampus.id)}
                        >
                          <Save size={13} className="inline mr-1" /> Save Senior Rule
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Junior School Card */}
            {(() => {
              const juniorCampus = campusesList.find(c => c.campus_id === 'JUNIOR_SCHOOL') || { id: 'JUNIOR_SCHOOL', campus_name: 'Junior School' };
              const juniorRule = getRuleForCampus('JUNIOR_SCHOOL');
              const isEditing = editingCampusRule === juniorCampus.id || editingCampusRule === 'JUNIOR_SCHOOL';

              return (
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                      <h4 className="font-bold text-sm text-white">Junior School</h4>
                    </div>
                    {profile?.role && ['admin', 'principal'].includes(profile.role) && !isEditing && (
                      <button
                        onClick={() => {
                          setEditingCampusRule(juniorCampus.id);
                          setRuleForm({
                            campusId: juniorCampus.id,
                            schoolStartTime: juniorRule.school_start_time?.slice(0, 5) || '08:40',
                            gracePeriodMinutes: juniorRule.grace_period_minutes ?? 10,
                            effectiveFrom: new Date().toISOString().split('T')[0],
                            reason: ''
                          });
                        }}
                        className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold"
                      >
                        <Edit size={13} /> Edit Rule
                      </button>
                    )}
                  </div>

                  {!isEditing ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-700/40">
                        <span className="text-slate-400">School Start Time:</span>
                        <strong className="text-slate-200 font-mono text-sm">{formatTime12(juniorRule.school_start_time)}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-700/40">
                        <span className="text-slate-400">Grace Period:</span>
                        <strong className="text-slate-200">{juniorRule.grace_period_minutes} minutes</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-700/40">
                        <span className="text-slate-400">Late Threshold:</span>
                        <strong className="text-amber-400 font-mono text-sm">{formatTime12(juniorRule.late_threshold)}</strong>
                      </div>
                      <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[11px] text-blue-300">
                        ✓ Check-in at or before <strong>{juniorRule.late_threshold?.slice(0, 5) || '08:50'}</strong> → <strong>PRESENT</strong><br />
                        ⚠ Check-in after <strong>{juniorRule.late_threshold?.slice(0, 5) || '08:50'}:00</strong> → <strong>LATE</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2 text-xs">
                      <div>
                        <label className="block text-slate-400 font-medium mb-1">School Start Time (HH:MM)</label>
                        <input
                          type="time"
                          className="input-field w-full text-xs"
                          value={ruleForm.schoolStartTime}
                          onChange={e => setRuleForm({ ...ruleForm, schoolStartTime: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-medium mb-1">Grace Period (Minutes)</label>
                        <input
                          type="number"
                          min="0"
                          className="input-field w-full text-xs"
                          value={ruleForm.gracePeriodMinutes}
                          onChange={e => setRuleForm({ ...ruleForm, gracePeriodMinutes: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="p-2 bg-slate-900/60 rounded-lg text-slate-300">
                        Computed Late Threshold: <strong className="text-amber-400 font-mono">{formatTime12(computeLateThreshold(ruleForm.schoolStartTime, ruleForm.gracePeriodMinutes))}</strong>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-medium mb-1">Effective From Date</label>
                        <input
                          type="date"
                          className="input-field w-full text-xs"
                          value={ruleForm.effectiveFrom}
                          onChange={e => setRuleForm({ ...ruleForm, effectiveFrom: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-medium mb-1">Audit Reason for Change *</label>
                        <textarea
                          rows="2"
                          className="input-field w-full text-xs"
                          placeholder="e.g. Approved start time adjustment for junior school assembly..."
                          value={ruleForm.reason}
                          onChange={e => setRuleForm({ ...ruleForm, reason: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <button
                          type="button"
                          className="btn-secondary text-xs py-1.5 px-3"
                          onClick={() => setEditingCampusRule(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingRule}
                          className="btn-primary text-xs py-1.5 px-3 bg-blue-600 hover:bg-blue-700"
                          onClick={() => handleSaveCampusRule(juniorCampus.id)}
                        >
                          <Save size={13} className="inline mr-1" /> Save Junior Rule
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="flex justify-between items-center pt-2 text-[11px] text-slate-400 border-t border-slate-800">
            <span>Server authoritative • Timezone: Asia/Kolkata (+05:30) • Rule modifications are immutably audited</span>
            <button className="btn-secondary text-xs py-1 px-3" onClick={() => { setShowSettings(false); setEditingCampusRule(null); }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'ATTENDANCE' ? (
        <div className="space-y-3">
          {/* Active Filter Indicator & Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={15} className="text-brand-500" />
              <span className="text-xs text-[var(--text-secondary)] font-medium">Filter:</span>
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                selectedStatusFilter === 'PRESENT' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' :
                selectedStatusFilter === 'LATE' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' :
                selectedStatusFilter === 'ABSENT' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30' :
                selectedStatusFilter === 'ON_LEAVE' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30' :
                selectedStatusFilter === 'VERIFIED_QR' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30' :
                'bg-slate-200 dark:bg-slate-800 text-[var(--text-primary)]'
              }`}>
                Showing: {
                  selectedStatusFilter === 'PRESENT' ? 'PRESENT' :
                  selectedStatusFilter === 'LATE' ? 'LATE' :
                  selectedStatusFilter === 'ABSENT' ? 'ABSENT' :
                  selectedStatusFilter === 'ON_LEAVE' ? 'ON LEAVE' :
                  selectedStatusFilter === 'VERIFIED_QR' ? 'VERIFIED QR' :
                  'ALL STAFF'
                }
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                ({displayedStaff.length} {displayedStaff.length === 1 ? 'record' : 'records'})
              </span>
              {(selectedStatusFilter !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => { setSelectedStatusFilter('ALL'); setSearchQuery(''); }}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-[var(--text-primary)] transition-colors ml-1"
                  title="Clear filter and return to all staff"
                >
                  <X size={12} /> Clear Filter
                </button>
              )}
            </div>

            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search staff by name or campus..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field text-xs pl-8 pr-8 py-1.5 w-full"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

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
                {displayedStaff.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12">
                      <div className="max-w-md mx-auto space-y-2">
                        <div className="text-slate-400 dark:text-slate-500 flex justify-center">
                          <Users size={36} className="opacity-40" />
                        </div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {searchQuery ? (
                            `No staff members matching "${searchQuery}" found for this filter.`
                          ) : selectedStatusFilter === 'PRESENT' ? (
                            'No staff members are currently marked Present for this date.'
                          ) : selectedStatusFilter === 'LATE' ? (
                            'No staff members are marked Late for this date.'
                          ) : selectedStatusFilter === 'ABSENT' ? (
                            'No staff members are marked Absent for this date.'
                          ) : selectedStatusFilter === 'ON_LEAVE' ? (
                            'No staff members are currently on Leave for this date.'
                          ) : selectedStatusFilter === 'VERIFIED_QR' ? (
                            'No Dynamic QR verified attendance records found for this date.'
                          ) : (
                            'No staff attendance records found for this date.'
                          )}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          Date: {dateFilter} • Campus: {selectedCampusObj?.campus_name || 'All Campuses'}
                        </p>
                        {(selectedStatusFilter !== 'ALL' || searchQuery) && (
                          <button
                            type="button"
                            onClick={() => { setSelectedStatusFilter('ALL'); setSearchQuery(''); }}
                            className="btn-secondary text-xs px-3 py-1.5 mt-2 inline-flex items-center gap-1.5"
                          >
                            <X size={13} /> Clear Filter & Show All Staff
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedStaff.map(f => (
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
                          onClick={() => handleStartEdit(f)} 
                          className="text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 p-2 rounded-full transition-colors"
                          title="Direct Administrative Correction"
                        >
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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

              {newStatus !== 'Absent' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Check-In Arrival Time *</label>
                  <input 
                    type="time" 
                    className="input-field py-2 font-mono w-full" 
                    value={correctionCheckInTime} 
                    onChange={e => setCorrectionCheckInTime(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Required arrival timestamp so employee is eligible for afternoon secure checkout.
                  </p>
                </div>
              )}

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

      {/* One-Click Emergency Bulk Attendance Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 text-slate-100 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-start bg-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Zap size={22} className="fill-amber-400" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white flex items-center gap-2">
                    One-Click Emergency Attendance
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Authoritatively mark teachers Present stamped before the 8:25 AM cutoff
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Campus Selector Tabs */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Select School Section
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSwitchBulkCampus('SENIOR_SCHOOL')}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      bulkCampusSlug === 'SENIOR_SCHOOL'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500 shadow-sm'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 size={18} className={bulkCampusSlug === 'SENIOR_SCHOOL' ? 'text-emerald-400' : 'text-slate-500'} />
                      <div className="text-left">
                        <div className="font-bold text-sm text-white">Senior School</div>
                        <div className="text-[11px] text-slate-400">Cutoff: 08:25 AM</div>
                      </div>
                    </div>
                    {bulkCampusSlug === 'SENIOR_SCHOOL' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSwitchBulkCampus('JUNIOR_SCHOOL')}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      bulkCampusSlug === 'JUNIOR_SCHOOL'
                        ? 'bg-blue-950/40 border-blue-500 text-blue-200 ring-1 ring-blue-500 shadow-sm'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 size={18} className={bulkCampusSlug === 'JUNIOR_SCHOOL' ? 'text-blue-400' : 'text-slate-500'} />
                      <div className="text-left">
                        <div className="font-bold text-sm text-white">Junior School</div>
                        <div className="text-[11px] text-slate-400">Cutoff: 08:50 AM</div>
                      </div>
                    </div>
                    {bulkCampusSlug === 'JUNIOR_SCHOOL' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                    )}
                  </button>
                </div>
              </div>

              {/* Timing info banner */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
                <Clock size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Rule Compliant Timestamp:</strong> Recorded check-in will be stamped at{' '}
                  <strong className="text-amber-300 font-mono">{bulkCheckInTime}:00 AM</strong> on{' '}
                  <strong className="text-amber-300">{dateFilter}</strong> (before the{' '}
                  {bulkCampusSlug === 'JUNIOR_SCHOOL' ? '08:50 AM' : '08:25 AM'} cutoff), ensuring all selected staff evaluate to{' '}
                  <span className="bg-emerald-500/30 text-emerald-300 font-bold px-1.5 py-0.5 rounded text-[11px]">
                    Present
                  </span>.
                </div>
              </div>

              {/* Input Grid: Date, Check-In Time, Selected Count */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Attendance Date
                  </label>
                  <input
                    type="date"
                    className="input-field w-full bg-slate-800 border-slate-700 text-white"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Check-In Time (<span className="text-amber-400">&lt; 8:25 AM</span>)
                  </label>
                  <input
                    type="time"
                    className="input-field w-full bg-slate-800 border-slate-700 text-white font-mono"
                    value={bulkCheckInTime}
                    onChange={(e) => setBulkCheckInTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Selected Count
                  </label>
                  <div className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-center font-black text-amber-400 text-sm">
                    {bulkSelectedTeacherIds.length} of {bulkTeachersList.length} Staff
                  </div>
                </div>
              </div>

              {/* Authoritative Staff Role Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] p-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl">
                <div><span className="text-slate-400">Teachers:</span> <strong className="text-white ml-1">{bulkSelectedTeacherIds.filter(id => teachers.find(t => t.id === id)?.role === 'teacher').length}</strong></div>
                <div><span className="text-slate-400">Coordinators:</span> <strong className="text-purple-400 ml-1">{bulkSelectedTeacherIds.filter(id => teachers.find(t => t.id === id)?.role === 'coordinator').length}</strong></div>
                <div><span className="text-slate-400">Group D:</span> <strong className="text-amber-400 ml-1">{bulkSelectedTeacherIds.filter(id => teachers.find(t => t.id === id)?.role === 'group_d').length}</strong></div>
                <div><span className="text-slate-400">Non-Teaching:</span> <strong className="text-blue-400 ml-1">{bulkSelectedTeacherIds.filter(id => teachers.find(t => t.id === id)?.role === 'non_teaching').length}</strong></div>
                <div><span className="text-slate-400">Other Staff:</span> <strong className="text-emerald-400 ml-1">{bulkSelectedTeacherIds.filter(id => !['teacher', 'coordinator', 'group_d', 'non_teaching'].includes(teachers.find(t => t.id === id)?.role)).length}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Audit Log Reason *
                </label>
                <input
                  type="text"
                  className="input-field w-full bg-slate-800 border-slate-700 text-white text-xs"
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="Reason for bulk override..."
                />
              </div>

              {/* Teacher Selection Header */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div className="text-xs font-bold text-slate-300">
                    Teachers in {bulkCampusSlug === 'JUNIOR_SCHOOL' ? 'Junior School' : 'Senior School'} ({filteredBulkTeachers.length})
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllBulk(filteredBulkTeachers)}
                      className="text-xs text-brand-400 hover:text-brand-300 font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeselectAllBulk(filteredBulkTeachers)}
                      className="text-xs text-slate-400 hover:text-slate-200 font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-2.5 text-slate-500" size={15} />
                  <input
                    type="text"
                    placeholder="Search staff by name or email..."
                    value={bulkSearchQuery}
                    onChange={(e) => setBulkSearchQuery(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Teachers Checkbox List */}
                <div className="border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-800/60 bg-slate-950/40">
                  {filteredBulkTeachers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No teachers matched the criteria.
                    </div>
                  ) : (
                    filteredBulkTeachers.map(teacher => {
                      const isSelected = bulkSelectedTeacherIds.includes(teacher.id);
                      const currentStatus = getTeacherCurrentStatus(teacher.id);
                      return (
                        <label
                          key={teacher.id}
                          className={`flex items-center justify-between p-2.5 px-3 hover:bg-slate-800/60 cursor-pointer transition-colors text-xs ${
                            isSelected ? 'bg-brand-500/10' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleBulkTeacher(teacher.id)}
                              className="rounded border-slate-700 text-brand-500 focus:ring-brand-500 w-4 h-4 bg-slate-800 cursor-pointer"
                            />
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{teacher.name}</span>
                                {teacher.campus && (
                                  <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700">
                                    {teacher.campus}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">{teacher.email || teacher.id}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              currentStatus === 'Present' || currentStatus === 'Present (Grace)'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : currentStatus === 'Late'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              Today: {currentStatus}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Feedback Alert */}
              {bulkFeedback && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  bulkFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {bulkFeedback.type === 'success' ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                  )}
                  <span>{bulkFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-800/60 flex items-center justify-between gap-3">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setShowBulkModal(false)}
              >
                Close
              </button>

              <button
                type="button"
                disabled={bulkSelectedTeacherIds.length === 0 || isProcessingBulk}
                onClick={handleExecuteBulkMarkPresent}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <Zap size={15} className="fill-slate-950" />
                {isProcessingBulk ? (
                  <span>Processing Attendance...</span>
                ) : (
                  <span>
                    Mark {bulkSelectedTeacherIds.length} Teachers Present ({formatTime12(bulkCheckInTime)})
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffAttendance;
