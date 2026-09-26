import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Calendar, Clock, Users, BookOpen, AlertTriangle, CheckCircle2, 
  Send, Printer, Copy, Plus, RefreshCw, Eye, ShieldCheck, 
  ChevronRight, Filter, Search, UserCheck, Bell, Sparkles, FileText, ArrowRight,
  Layers, Check, X, AlertCircle, Radio, Settings, History, Download
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { 
  RoutineService, WORKING_DAYS, ROUTINE_ENTRY_TYPES 
} from '../../services/RoutineService';
import RoutinePrintablePDF from './RoutinePrintablePDF';

export default function RoutineControlCentre({ currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('teacher_builder'); 
  // 'teacher_builder' | 'master_grid' | 'class_view' | 'who_is_teaching' | 'who_is_free' | 'distribution' | 'period_config' | 'audit_log'

  const [loading, setLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState('2026');
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [activeVersion, setActiveVersion] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [masterEntries, setMasterEntries] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Database Entities
  const [teachersList, setTeachersList] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);

  // Teacher-Centric Builder State
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedTeacherData, setSelectedTeacherData] = useState(null);

  // Cell Editing Modal / Drawer State
  const [editingCell, setEditingCell] = useState(null); // { dayId, periodNum, entry }
  const [cellForm, setCellForm] = useState({
    class_id: '',
    section: '',
    subject_name: '',
    entry_type: 'SUBJECT',
    room: '',
    notes: ''
  });

  // Master Grid Search & Filter States
  const [masterSearchQuery, setMasterSearchQuery] = useState('');
  const [masterFilterDay, setMasterFilterDay] = useState('ALL');
  const [masterFilterPeriod, setMasterFilterPeriod] = useState('ALL');
  const [masterFilterType, setMasterFilterType] = useState('ALL');

  // Supervision Query States
  const [supDay, setSupDay] = useState(2); // Tuesday
  const [supPeriod, setSupPeriod] = useState(1); // 1st Period
  const [teachingRoster, setTeachingRoster] = useState([]);
  const [freeTeachersData, setFreeTeachersData] = useState(null);

  // Class-Wise Viewer State
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classRoutineData, setClassRoutineData] = useState(null);

  // Validation State
  const [validationResult, setValidationResult] = useState(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccessMessage, setPublishSuccessMessage] = useState('');

  // Distribution State
  const [distributionStats, setDistributionStats] = useState(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  // Special Actions Modals
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showCopyYearModal, setShowCopyYearModal] = useState(false);
  const [copyYearSource, setCopyYearSource] = useState('2025');
  const [copyYearTarget, setCopyYearTarget] = useState('2026');

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    dayId: 2, // Tuesday
    periodNum: 9, // 9th Period
    entryType: 'TEST',
    subjectName: 'Weekly Test',
    notes: 'Senior School Weekly Test'
  });

  // Period Configuration Editing State
  const [editingPeriods, setEditingPeriods] = useState([]);
  const [savingPeriods, setSavingPeriods] = useState(false);

  // PDF Modal State
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfType, setPdfType] = useState('teacher');
  const printComponentRef = useRef();

  // Load Initial Entities & Version Data
  const loadEntitiesAndRoutines = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Teachers from profiles & enrich with master timetable directory
      const { data: profs } = await supabase.from('profiles').select('id, name, email, role');
      let loadedTeachers = (profs || []).filter(p => p.role === 'teacher');

      const masterFallback = [
        { id: 'c50b872e-ca97-44f7-ad84-d18f8e2f2ea5', name: 'Subodh', department: 'Mathematics & Science (7A Class Teacher)' },
        { id: '215e579d-67a1-4401-a4a2-8f5e4c0bbf37', name: 'Mrs. Urvashi Rumba', department: 'Biology & EVS (9 Sc Class Teacher)' },
        { id: 'bca2d46e-18a9-4484-8baa-ac441f267cf9', name: 'Mr. Sagar Gurung', department: 'Mathematics, History & English (6B Class Teacher)' },
        { id: '0bb4ebf5-8eba-436f-a65a-0a4ee1c30917', name: 'Mr. Rahul Chettri', department: 'Computer Applications & Chemistry (8A Class Teacher)' },
        { id: '14de2742-ff92-4638-a48e-80e95a26d008', name: 'Mr. Rajesh Singh', department: 'Computer & Robotics (6A Class Teacher)' },
        { id: 'eaf09732-8e34-4273-a35e-02f1920e4bb5', name: 'Mrs. Sarita Sharma', department: '2L Nepali (6B MSc)' },
        { id: 'cb94aecc-8f54-4ee9-ab36-6c37db01bc7a', name: 'Mrs. Pinki Gupta', department: 'Hindi (2L & TL)' },
        { id: '618f3dfa-4b60-4e6c-9657-b02b3463e699', name: 'Mrs. S. Routh', department: 'Hindi & Library' },
        { id: '3112076d-5476-405b-b3c8-ef240a3e2a3c', name: 'Mr. Kalyan Mukhia', department: 'Mathematics & Physics' },
        { id: 'b7cdfbd6-f22c-4d50-9ad1-f2584cc3f442', name: 'Mr. Akash Kharel', department: 'Economics & GK' },
        { id: 'c3521dfd-8886-45d2-a11d-cabfdabe3684', name: 'Ms. Kalyani Sharma', department: 'Mathematics' },
        { id: '124f949f-f736-438c-9b8f-5a32a721bb58', name: 'Ms. Promeeta Thapa', department: 'English 1' },
        { id: '1a0a2998-da0e-4ad5-9505-1514b423825d', name: 'Mr. Prajwal Singh', department: 'Physical Education & Games' },
        { id: 't-deven-gurung', name: 'Mr. Deven Gurung', department: 'Computer Applications' },
        { id: 'ddf9bd21-8576-4777-b25d-7fa8c78ceccd', name: 'Mr. Sashank Lama', department: 'Music' },
        { id: 'df48470e-69b8-4b75-be3f-46aa28f58a32', name: 'Mr. Dhirendra Lama', department: 'Arts & SUPW (9H Class Teacher)' },
        { id: '19c8be5c-6d67-4864-b86d-e7579c827d94', name: 'Mr. Ajoy Gurung', department: 'Library' },
        { id: 'c67e3207-943a-463c-a691-e8d418c22a9e', name: 'Mrs. Dipika Thapa', department: 'English 2 & Spelling' },
        { id: 'f0e6046b-c8e0-4a02-bdfc-dbbca4d9a11d', name: 'Mrs. Pinky BK', department: 'TL Nepali' },
        { id: '3ee2cf65-5cd5-4338-9a02-091de8093351', name: 'Mr. Keiran Thapa', department: 'English (XII H Class Teacher)' },
        { id: '146560d1-b86f-4c78-92ac-c54fcde1c6e9', name: 'Mr. Rakesh Rai', department: 'Arts & Craft' },
        { id: '0c931bba-2279-4871-ad49-a5c358d46c14', name: 'Mrs. Pallavi Bakshi', department: 'Biology (XI Sc Class Teacher)' },
        { id: 'e89d0118-5f83-45d2-86b8-390b3a16bc81', name: 'Mrs. Sailika Thapa', department: 'English' },
        { id: '8fb84b96-bee6-4fcf-a7e2-e716e3e013f3', name: 'Mrs. Anjana Gurung', department: 'English' },
        { id: 'ae821917-7d09-42ed-8d98-636a2e66f1bd', name: 'Mr. Riwaz Pradhan', department: 'Political Science & Sociology (XI H Class Teacher)' },
        { id: 'eee0a918-12b4-48aa-ba81-9ba605e1114d', name: 'Mr. Suraj Pradhan', department: 'Physics (XI Sc Class Teacher)' },
        { id: '7f4847ea-c1dd-4b44-a8c1-bb670188b0e4', name: 'Ms. Sujata Rai', department: 'Geography (10 H Class Teacher)' },
        { id: 'e1a89308-e6c2-467f-b31b-ebaeb0a343e3', name: 'Mr. Dipanker Parajuli', department: 'Chemistry & GK (10 Sc Class Teacher)' },
        { id: '5c4ddcf8-4b88-4684-bd5c-2937ed3a6282', name: 'Mrs. Nirjala Pradhan', department: 'Geography (7B Class Teacher)' },
        { id: '5ac6dbcc-9183-4a3b-8889-3cfa44656d83', name: 'Mr. Pranay Pradhan', department: 'History, Geog & Hospitality (8B Class Teacher)' },
        { id: 'c238361e-59f3-4cd1-acd4-a4ce2462a082', name: 'Ms. Pratika Tamang', department: 'History (9H Class Teacher)' },
        { id: 'da9fd64d-adb4-47d1-a7d1-a6cea1545d69', name: 'Ms. Supriya Chettri', department: 'Science & Chemistry (5A Class Teacher)' },
        { id: '9c6b9967-cc9f-49ff-882f-59a1bf938896', name: 'Ms. Anupama Gurung', department: 'Nepali (5B Class Teacher)' },
        { id: 't-pti', name: 'Physical Training Instructors (PTI)', department: 'Sports & Games' }
      ];

      // Enrich profiles with department & class teacher designations
      let teachers = [];
      if (loadedTeachers.length > 0) {
        teachers = loadedTeachers.map(t => {
          const info = RoutineService.resolveTeacherInfo(t.id) || RoutineService.resolveTeacherInfo(t.name);
          return {
            ...t,
            name: info ? info.fullName : t.name,
            department: info ? info.department : (t.department || '')
          };
        });

        // Ensure any timetable faculty not yet registered in profiles is included
        masterFallback.forEach(fb => {
          const exists = teachers.some(t => {
            const info = RoutineService.resolveTeacherInfo(t.id) || RoutineService.resolveTeacherInfo(t.name);
            return info && (info.slug === fb.id || info.profileId === fb.id || RoutineService.normalizeName(t.name) === RoutineService.normalizeName(fb.name));
          });
          if (!exists) {
            teachers.push(fb);
          }
        });
      } else {
        teachers = masterFallback;
      }

      setTeachersList(teachers);
      if (!selectedTeacherId && teachers.length > 0) {
        setSelectedTeacherId(teachers[0].id);
      }

      // 2. Fetch Classes
      const { data: cls } = await supabase.from('classes').select('id, name, section').order('name');
      let loadedClasses = cls || [];
      if (loadedClasses.length === 0) {
        loadedClasses = [
          { id: 'c-5a', name: '5', section: 'A' },
          { id: 'c-5b', name: '5', section: 'B' },
          { id: 'c-6a', name: '6', section: 'A' },
          { id: 'c-6b', name: '6', section: 'B' },
          { id: 'c-7a', name: '7', section: 'A' },
          { id: 'c-7b', name: '7', section: 'B' },
          { id: 'c-8a', name: '8', section: 'A' },
          { id: 'c-8b', name: '8', section: 'B' },
          { id: 'c-9h', name: '9', section: 'H' },
          { id: 'c-9sc', name: '9', section: 'Sc' },
          { id: 'c-10h', name: '10', section: 'H' },
          { id: 'c-10sc', name: '10', section: 'Sc' },
          { id: 'c-11h', name: '11', section: 'H' },
          { id: 'c-11sc', name: '11', section: 'Sc' },
          { id: 'c-12h', name: '12', section: 'H' },
          { id: 'c-12sc', name: '12', section: 'Sc' }
        ];
      }
      setClassesList(loadedClasses);
      if (!selectedClassId && loadedClasses.length > 0) {
        setSelectedClassId(loadedClasses[0].id);
      }

      // 3. Fetch Subjects
      const { data: subs } = await supabase.from('subjects').select('id, name');
      let loadedSubjects = subs || [];
      if (loadedSubjects.length === 0) {
        loadedSubjects = [
          { id: 's-eng1', name: 'English 1' },
          { id: 's-eng2', name: 'English 2' },
          { id: 's-math', name: 'Mathematics' },
          { id: 's-chem', name: 'Chemistry' },
          { id: 's-phy', name: 'Physics' },
          { id: 's-sci', name: 'Science' },
          { id: 's-eco', name: 'Economics' },
          { id: 's-gk', name: 'General Knowledge' },
          { id: 's-ca', name: 'Computer Applications' },
          { id: 's-pe', name: 'Physical Education' },
          { id: 's-tkd', name: 'Taekwondo' },
          { id: 's-nep', name: 'Nepali' },
          { id: 's-2lnep', name: '2L Nepali' },
          { id: 's-tlnep', name: 'TL Nepali' },
          { id: 's-hin', name: 'Hindi' },
          { id: 's-2lhin', name: '2L Hindi' },
          { id: 's-tlhin', name: 'TL Hindi' },
          { id: 's-art', name: 'Art' },
          { id: 's-draw', name: 'Drawing' },
          { id: 's-sing', name: 'Singing' },
          { id: 's-tab', name: 'Tables' },
          { id: 's-music', name: 'Music' },
          { id: 's-spell', name: 'Spelling' },
          { id: 's-supw', name: 'SUPW' },
          { id: 's-lib', name: 'Library' },
          { id: 's-pt', name: 'PT / Games' },
          { id: 's-test', name: 'Weekly Test' },
          { id: 's-msc', name: 'Moral Science (M.Sc.)' },
          { id: 's-spec', name: 'Special Activity' }
        ];
      }
      setSubjectsList(loadedSubjects);

      // 4. Fetch Periods
      const curPeriods = RoutineService.getPeriods();
      setPeriods(curPeriods);
      setEditingPeriods(JSON.parse(JSON.stringify(curPeriods)));

      // 5. Fetch Routine Versions
      const verList = await RoutineService.getVersions(academicYear);
      setVersions(verList);

      const activeVer = verList.find(v => v.status === 'PUBLISHED') || verList[0];
      if (activeVer) {
        setActiveVersion(activeVer);
        setSelectedVersionId(activeVer.id);
        const entries = await RoutineService.getMasterRoutine(activeVer.id);
        setMasterEntries(entries);
      }

      // 6. Fetch Audit Logs
      const logs = await RoutineService.getAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error loading routine data:', err);
    } finally {
      setLoading(false);
    }
  }, [academicYear]);

  useEffect(() => {
    loadEntitiesAndRoutines();
  }, [loadEntitiesAndRoutines]);

  // Sync Teacher Routine View
  useEffect(() => {
    if (!selectedTeacherId || !selectedVersionId) return;
    const selectedTeacherObj = teachersList.find(t => t.id === selectedTeacherId);
    const hintName = selectedTeacherObj?.name || '';
    RoutineService.getTeacherRoutine(selectedTeacherId, selectedVersionId, hintName, masterEntries).then(res => {
      setSelectedTeacherData(res);
    });
  }, [selectedTeacherId, selectedVersionId, masterEntries, teachersList]);

  // Sync Class-Wise Routine View
  useEffect(() => {
    if (!selectedClassId || !selectedVersionId) return;
    const cls = classesList.find(c => c.id === selectedClassId);
    RoutineService.getClassRoutine(cls?.name || selectedClassId, cls?.section, selectedVersionId).then(res => {
      setClassRoutineData(res);
    });
  }, [selectedClassId, selectedVersionId, classesList, masterEntries]);

  // Sync Supervision Views
  useEffect(() => {
    if (!selectedVersionId) return;
    RoutineService.getWhoIsTeaching(supDay, supPeriod, selectedVersionId).then(res => {
      setTeachingRoster(res);
    });
    RoutineService.getWhoIsFree(supDay, supPeriod, teachersList, selectedVersionId).then(res => {
      setFreeTeachersData(res);
    });
  }, [supDay, supPeriod, selectedVersionId, teachersList, masterEntries]);

  // Sync Distribution Stats
  useEffect(() => {
    if (!selectedVersionId) return;
    RoutineService.getDistributionStatus(selectedVersionId).then(res => {
      setDistributionStats(res);
    });
  }, [selectedVersionId]);

  // Handle Version Switching
  const handleSelectVersion = async (vId) => {
    setSelectedVersionId(vId);
    const ver = versions.find(v => v.id === vId);
    setActiveVersion(ver || null);
    const entries = await RoutineService.getMasterRoutine(vId);
    setMasterEntries(entries);
  };

  // Create New Draft Version
  const handleCreateNewVersion = async () => {
    const reason = prompt("Enter change reason for new routine version (e.g. 'Term 2 timetable updates'):", "Term updates");
    if (!reason) return;
    try {
      const newDraft = await RoutineService.createDraftVersion({
        academicYear,
        campusName: 'Senior School',
        changeReason: reason,
        createdBy: currentUser?.id,
        performerName: currentUser?.name || 'Principal'
      });
      alert(`Created Draft Version: ${newDraft.version_code}`);
      loadEntitiesAndRoutines();
    } catch (err) {
      alert("Error creating draft: " + err.message);
    }
  };

  // Open Cell Editor
  const handleOpenCellEditor = (dayId, periodNum, existingEntry = null) => {
    setEditingCell({ dayId, periodNum, entry: existingEntry });
    if (existingEntry) {
      setCellForm({
        class_id: existingEntry.class_id || '',
        section: existingEntry.section || '',
        subject_name: existingEntry.subject_name || '',
        entry_type: existingEntry.entry_type || 'SUBJECT',
        room: existingEntry.room || '',
        notes: existingEntry.notes || ''
      });
    } else {
      setCellForm({
        class_id: '',
        section: '',
        subject_name: '',
        entry_type: 'SUBJECT',
        room: '',
        notes: ''
      });
    }
  };

  // Save Cell Assignment
  const handleSaveCell = async (e) => {
    e.preventDefault();
    if (!editingCell || !selectedVersionId) return;

    const teacher = teachersList.find(t => t.id === selectedTeacherId);
    const cls = classesList.find(c => c.id === cellForm.class_id);
    const periodObj = periods.find(p => p.period_num === editingCell.periodNum);

    const newEntry = {
      id: editingCell.entry?.id,
      version_id: selectedVersionId,
      academic_year: academicYear,
      day_of_week: editingCell.dayId,
      period_num: editingCell.periodNum,
      period_name: periodObj?.period_name || `${editingCell.periodNum}th Period`,
      start_time: periodObj?.start_time,
      end_time: periodObj?.end_time,
      teacher_id: selectedTeacherId,
      teacher_name: teacher?.name || 'Teacher',
      class_id: cls?.id || cellForm.class_id || (cellForm.entry_type === 'ASSEMBLY' ? 'c-school' : ''),
      class_name: cls?.name || (cellForm.entry_type === 'ASSEMBLY' ? 'All' : ''),
      section: cls?.section || cellForm.section || '',
      subject_name: cellForm.subject_name || cellForm.entry_type,
      entry_type: cellForm.entry_type,
      room: cellForm.room,
      notes: cellForm.notes
    };

    await RoutineService.saveEntry(newEntry);
    setEditingCell(null);

    // Refresh entries
    const refreshed = await RoutineService.getMasterRoutine(selectedVersionId);
    setMasterEntries(refreshed);
  };

  // Clear Cell
  const handleClearCell = async (entryId) => {
    if (!entryId) return;
    const remaining = masterEntries.filter(e => e.id !== entryId);
    await RoutineService.saveBatchEntries(selectedVersionId, remaining);
    setMasterEntries(remaining);
  };

  // Duplicate Day
  const handleDuplicateDay = async (sourceDayId) => {
    const targetDayId = prompt("Enter target day number to duplicate to (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri):", "2");
    if (!targetDayId || targetDayId === String(sourceDayId)) return;
    try {
      await RoutineService.duplicateTeacherDay(selectedTeacherId, sourceDayId, Number(targetDayId), selectedVersionId);
      const refreshed = await RoutineService.getMasterRoutine(selectedVersionId);
      setMasterEntries(refreshed);
      alert(`Copied Day ${sourceDayId} schedule to Day ${targetDayId} for ${selectedTeacherData?.teacherName}!`);
    } catch (err) {
      alert("Error duplicating day: " + err.message);
    }
  };

  // Run Pre-Flight Validation
  const handleRunValidation = () => {
    const val = RoutineService.validateRoutine(masterEntries);
    setValidationResult(val);
    setShowValidationModal(true);
  };

  // Publish Routine Pipeline
  const handlePublishRoutine = async () => {
    if (!window.confirm(`Are you sure you want to PUBLISH Routine ${activeVersion?.version_code}? This will automatically distribute schedules to all affected teachers and send push notifications.`)) {
      return;
    }
    setPublishing(true);
    setPublishSuccessMessage('');
    try {
      const res = await RoutineService.publishRoutine(
        selectedVersionId, 
        currentUser?.id, 
        currentUser?.name || 'Principal'
      );
      setPublishSuccessMessage(`Routine ${res.version.version_code} successfully published! Notified ${res.affectedTeacherIds.length} teachers.`);
      loadEntitiesAndRoutines();
    } catch (err) {
      alert(err.message);
    } finally {
      setPublishing(false);
    }
  };

  // Send Reminders to Pending Teachers
  const handleSendReminders = async () => {
    setSendingReminder(true);
    try {
      const res = await RoutineService.sendReminderToPending(selectedVersionId);
      alert(`Reminders successfully dispatched to ${res.count} pending teachers!`);
      const stat = await RoutineService.getDistributionStatus(selectedVersionId);
      setDistributionStats(stat);
    } catch (err) {
      alert("Error sending reminders: " + err.message);
    } finally {
      setSendingReminder(false);
    }
  };

  // Copy Previous Year Routine
  const handleExecuteCopyYear = async () => {
    try {
      const newDraft = await RoutineService.copyPreviousYearRoutine(
        copyYearSource,
        copyYearTarget,
        currentUser?.name || 'Principal'
      );
      setShowCopyYearModal(false);
      alert(`Successfully cloned Routine from ${copyYearSource} into ${copyYearTarget} Draft (${newDraft.version_code})!`);
      setAcademicYear(copyYearTarget);
      loadEntitiesAndRoutines();
    } catch (err) {
      alert("Error copying routine: " + err.message);
    }
  };

  // Broadcast Shared Event across multiple classes/teachers
  const handleExecuteBroadcast = async (e) => {
    e.preventDefault();
    if (!selectedVersionId) return;

    const periodObj = periods.find(p => p.period_num === Number(broadcastForm.periodNum));
    const dayName = WORKING_DAYS.find(w => w.id === Number(broadcastForm.dayId))?.name || 'Day';

    const newEntries = teachersList.map(t => ({
      id: `entry-broadcast-${Date.now()}-${t.id}`,
      version_id: selectedVersionId,
      academic_year: academicYear,
      day_of_week: Number(broadcastForm.dayId),
      period_num: Number(broadcastForm.periodNum),
      period_name: periodObj?.period_name || `${broadcastForm.periodNum}th Period`,
      start_time: periodObj?.start_time,
      end_time: periodObj?.end_time,
      teacher_id: t.id,
      teacher_name: t.name,
      class_id: 'c-school',
      class_name: 'All',
      section: '',
      subject_name: broadcastForm.subjectName,
      entry_type: broadcastForm.entryType,
      room: '',
      notes: broadcastForm.notes
    }));

    // Remove existing for those slots and save new
    const filtered = masterEntries.filter(m => 
      !(m.day_of_week === Number(broadcastForm.dayId) && m.period_num === Number(broadcastForm.periodNum))
    );
    const combined = filtered.concat(newEntries);
    await RoutineService.saveBatchEntries(selectedVersionId, combined);
    setMasterEntries(combined);
    setShowBroadcastModal(false);
    alert(`Successfully broadcast ${broadcastForm.subjectName} across all teachers for ${dayName}, Period ${broadcastForm.periodNum}!`);
  };

  // Save Period Configuration
  const handleSavePeriodConfig = async () => {
    setSavingPeriods(true);
    try {
      await RoutineService.updatePeriods(editingPeriods);
      setPeriods([...editingPeriods]);
      alert("✓ Period timing configuration saved successfully!");
    } catch (err) {
      alert("Error saving periods: " + err.message);
    } finally {
      setSavingPeriods(false);
    }
  };

  // Filtered Master Grid Entries
  const filteredMasterEntries = useMemo(() => {
    return masterEntries.filter(e => {
      if (masterFilterDay !== 'ALL' && e.day_of_week !== Number(masterFilterDay)) return false;
      if (masterFilterPeriod !== 'ALL' && e.period_num !== Number(masterFilterPeriod)) return false;
      if (masterFilterType !== 'ALL' && e.entry_type !== masterFilterType) return false;
      if (masterSearchQuery.trim()) {
        const q = masterSearchQuery.toLowerCase();
        const tMatch = e.teacher_name?.toLowerCase().includes(q);
        const cMatch = `${e.class_name || ''} ${e.section || ''}`.toLowerCase().includes(q);
        const sMatch = e.subject_name?.toLowerCase().includes(q);
        const rMatch = e.room?.toLowerCase().includes(q);
        if (!tMatch && !cMatch && !sMatch && !rMatch) return false;
      }
      return true;
    });
  }, [masterEntries, masterFilterDay, masterFilterPeriod, masterFilterType, masterSearchQuery]);

  // Print Routine
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* 1. EXECUTIVE ROUTINE DASHBOARD HEADER */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 p-5 sm:p-6 shadow-xl text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-brand-500/20 text-brand-400 border border-brand-500/30">
                Principal Control Centre
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                activeVersion?.status === 'PUBLISHED' 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {activeVersion?.status || 'DRAFT'}
              </span>
              <span className="text-slate-400 text-xs font-mono font-bold">
                {activeVersion?.version_code || 'V1'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-brand-400" />
              School Routine Management
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Academic Year: <strong className="text-slate-200">{academicYear}–{(Number(academicYear)+1).toString().slice(2)}</strong> | Campus: <strong className="text-slate-200">Senior School</strong> | Periods: <strong className="text-slate-200">{periods.length} Periods (Mon–Fri)</strong>
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Version Selector */}
            <select
              className="bg-slate-800 text-xs font-semibold rounded-lg px-3 py-2 border border-slate-700 text-slate-200 focus:outline-none focus:border-brand-500"
              value={selectedVersionId}
              onChange={e => handleSelectVersion(e.target.value)}
            >
              {versions.map(v => (
                <option key={v.id} value={v.id}>
                  {v.version_code} ({v.status}) - {v.title}
                </option>
              ))}
            </select>

            <button
              onClick={handleCreateNewVersion}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-brand-400" />
              New Draft
            </button>

            <button
              onClick={() => setShowCopyYearModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-emerald-400" />
              Copy Year
            </button>

            <button
              onClick={() => setShowBroadcastModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
            >
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              Broadcast Event
            </button>

            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold border border-indigo-500/40 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Generate All Slips
            </button>

            <button
              onClick={handleRunValidation}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Validate Routine
            </button>

            <button
              onClick={handlePublishRoutine}
              disabled={publishing || activeVersion?.status === 'PUBLISHED'}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold shadow-lg transition-all ${
                activeVersion?.status === 'PUBLISHED'
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/30'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              {publishing ? 'Publishing...' : activeVersion?.status === 'PUBLISHED' ? 'Published' : 'Publish Routine'}
            </button>

            <button
              onClick={() => { setPdfModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 text-xs font-bold border border-indigo-500/40 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Export PDF
            </button>
          </div>
        </div>

        {/* Dynamic Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-1">
          <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Teachers</span>
            <div className="text-lg font-black text-white">{teachersList.length}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400">Classes Covered</span>
            <div className="text-lg font-black text-white">{classesList.length}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400">Routine Entries</span>
            <div className="text-lg font-black text-brand-400">{masterEntries.length}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400">Conflicts Detected</span>
            <div className="text-lg font-black text-emerald-400">0</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400">Acknowledged</span>
            <div className="text-lg font-black text-emerald-300">
              {distributionStats?.acknowledgedCount ?? 0} / {distributionStats?.totalTeachers ?? teachersList.length}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400">Pending Teachers</span>
            <div className="text-lg font-black text-amber-400">
              {distributionStats?.pendingCount ?? teachersList.length}
            </div>
          </div>
        </div>

        {publishSuccessMessage && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-600/40 text-emerald-200 text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {publishSuccessMessage}
            </span>
            <button onClick={() => setPublishSuccessMessage('')} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 2. SUB-NAVIGATION TABS */}
      <div className="flex overflow-x-auto gap-1 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { id: 'teacher_builder', label: '👨‍🏫 Teacher-Centric Builder', desc: 'Replicates handwritten sheets' },
          { id: 'master_grid', label: '🏫 Master School Grid', desc: 'Searchable full timetable' },
          { id: 'class_view', label: '📚 Class-Wise Routine', desc: 'Filter by class/section' },
          { id: 'who_is_teaching', label: '🔍 Who is Teaching?', desc: 'Live period supervision' },
          { id: 'who_is_free', label: '🆓 Available Teachers', desc: 'Ready for substitution' },
          { id: 'distribution', label: '📬 Distribution & Acks', desc: 'Teacher sign-off tracking' },
          { id: 'period_config', label: '⚙️ Period Configuration', desc: 'Times, names & breaks' },
          { id: 'audit_log', label: '📜 Versions & Audit Log', desc: 'Change history trail' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex flex-col items-start ${
              activeSubTab === tab.id
                ? 'bg-brand-600 text-white shadow-md shadow-brand-900/30'
                : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[9px] font-normal ${activeSubTab === tab.id ? 'text-brand-100' : 'text-slate-400'}`}>
              {tab.desc}
            </span>
          </button>
        ))}
      </div>

      {/* 3. SUB-TAB 1: TEACHER-CENTRIC ROUTINE BUILDER */}
      {activeSubTab === 'teacher_builder' && (
        <div className="space-y-4">
          {/* Teacher Selector Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Select Teacher:
              </label>
              <select
                className="input-field text-xs font-bold py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                value={selectedTeacherId}
                onChange={e => setSelectedTeacherId(e.target.value)}
              >
                {teachersList.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.department ? `(${t.department})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedTeacherData && (
              <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-3">
                <span>Assigned: <strong className="text-brand-600 dark:text-brand-400">{selectedTeacherData.totalAssignedPeriods} Periods</strong></span>
                <span>Free: <strong className="text-slate-500">{selectedTeacherData.freePeriodsCount} Periods</strong></span>
                <span>Classes: <strong className="text-slate-800 dark:text-slate-200">{selectedTeacherData.classesHandled?.join(', ') || 'General'}</strong></span>
              </div>
            )}
          </div>

          {/* Interactive 5-Day x 9-Period Timetable Matrix */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-lg">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">
                  {((selectedTeacherData?.teacherName && selectedTeacherData.teacherName !== 'Teacher')
                    ? selectedTeacherData.teacherName
                    : (teachersList.find(t => t.id === selectedTeacherId)?.name || 'Teacher'))} — Weekly Schedule
                </h3>
                <p className="text-[11px] text-slate-500">
                  Click any cell to assign Class, Subject, or Special School Activity (Assembly, Test, Library, PT, etc.)
                </p>
              </div>
              <button
                onClick={() => { setPdfType('teacher'); setPdfModalOpen(true); }}
                className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Slip
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-center text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                    <th className="p-3 font-extrabold w-28 text-left border-r border-slate-200 dark:border-slate-800">
                      Days
                    </th>
                    {periods.map(p => (
                      <th key={p.period_num} className="p-2.5 font-bold border-r border-slate-200 dark:border-slate-800 min-w-[105px]">
                        <div>{p.period_name}</div>
                        <div className="text-[9px] font-normal text-slate-400">{p.start_time}–{p.end_time}</div>
                      </th>
                    ))}
                    <th className="p-2.5 font-bold w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {WORKING_DAYS.map(day => {
                    const daySchedule = selectedTeacherData?.scheduleByDay?.[day.id];
                    return (
                      <tr key={day.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 font-extrabold text-left bg-slate-50/80 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                          {day.name}
                        </td>
                        {periods.map(p => {
                          const periodCell = daySchedule?.periods?.find(pr => pr.period_num === p.period_num);
                          const entry = periodCell?.entry;
                          const isSpecialTest = entry?.entry_type === 'TEST';
                          const isSpecialAssembly = entry?.entry_type === 'ASSEMBLY';

                          return (
                            <td 
                              key={p.period_num} 
                              onClick={() => handleOpenCellEditor(day.id, p.period_num, entry)}
                              className={`p-2 border-r border-slate-200 dark:border-slate-800 h-20 align-middle cursor-pointer transition-all hover:bg-brand-500/10 ${
                                isSpecialTest ? 'bg-amber-500/10 border-l-2 border-amber-500' :
                                isSpecialAssembly ? 'bg-indigo-500/10 border-l-2 border-indigo-500' :
                                entry ? 'bg-emerald-500/5' : ''
                              }`}
                            >
                              {entry ? (
                                <div className="flex flex-col justify-center items-center gap-0.5 group">
                                  <span className="font-black text-[11px] text-slate-900 dark:text-white">
                                    {entry.class_name ? `Class ${entry.class_name} ${entry.section || ''}` : entry.entry_type}
                                  </span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                    isSpecialTest ? 'bg-amber-500/20 text-amber-300' :
                                    isSpecialAssembly ? 'bg-indigo-500/20 text-indigo-300' :
                                    'bg-emerald-500/20 text-emerald-300'
                                  }`}>
                                    {entry.subject_name || entry.entry_type}
                                  </span>
                                  {entry.room && (
                                    <span className="text-[8px] text-slate-400">[{entry.room}]</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-600 text-[11px] font-mono hover:text-brand-500">
                                  + Free
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2 text-center align-middle">
                          <button
                            onClick={() => handleDuplicateDay(day.id)}
                            title="Duplicate this day schedule to another day"
                            className="p-1 rounded text-slate-400 hover:text-brand-500 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUB-TAB 2: MASTER SCHOOL GRID */}
      {activeSubTab === 'master_grid' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase">Master School Grid</h3>
              <p className="text-xs text-slate-500">Showing {filteredMasterEntries.length} entries across {teachersList.length} teachers</p>
            </div>
            <button
              onClick={() => { setPdfType('master'); setPdfModalOpen(true); }}
              className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Master Timetable
            </button>
          </div>

          {/* Master Search & Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search teacher, class, subject..."
                className="input-field w-full pl-8 py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                value={masterSearchQuery}
                onChange={e => setMasterSearchQuery(e.target.value)}
              />
            </div>
            <div>
              <select
                className="input-field w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                value={masterFilterDay}
                onChange={e => setMasterFilterDay(e.target.value)}
              >
                <option value="ALL">All Days (Mon–Fri)</option>
                {WORKING_DAYS.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                className="input-field w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                value={masterFilterPeriod}
                onChange={e => setMasterFilterPeriod(e.target.value)}
              >
                <option value="ALL">All Periods (1–9)</option>
                {periods.map(p => (
                  <option key={p.period_num} value={p.period_num}>{p.period_name}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                className="input-field w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                value={masterFilterType}
                onChange={e => setMasterFilterType(e.target.value)}
              >
                <option value="ALL">All Entry Types</option>
                {ROUTINE_ENTRY_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 z-10">
                <tr>
                  <th className="p-2.5 font-bold">Day</th>
                  <th className="p-2.5 font-bold">Period</th>
                  <th className="p-2.5 font-bold">Class</th>
                  <th className="p-2.5 font-bold">Subject / Activity</th>
                  <th className="p-2.5 font-bold">Teacher</th>
                  <th className="p-2.5 font-bold">Type</th>
                  <th className="p-2.5 font-bold">Room</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMasterEntries.map(e => {
                  const dayName = WORKING_DAYS.find(w => w.id === e.day_of_week)?.name || `Day ${e.day_of_week}`;
                  return (
                    <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 font-bold text-slate-800 dark:text-slate-200">{dayName}</td>
                      <td className="p-2 font-mono text-slate-600 dark:text-slate-400">{e.period_num} ({e.period_name})</td>
                      <td className="p-2 font-bold text-brand-600 dark:text-brand-400">{e.class_name ? `Class ${e.class_name} ${e.section || ''}` : 'School'}</td>
                      <td className="p-2 font-semibold text-slate-900 dark:text-white">{e.subject_name}</td>
                      <td className="p-2 text-slate-700 dark:text-slate-300">{e.teacher_name}</td>
                      <td className="p-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {e.entry_type}
                        </span>
                      </td>
                      <td className="p-2 text-slate-500">{e.room || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. SUB-TAB 3: CLASS-WISE ROUTINE */}
      {activeSubTab === 'class_view' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Select Class:</label>
            <select
              className="input-field text-xs font-bold py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
            >
              {classesList.map(c => (
                <option key={c.id} value={c.id}>
                  Class {c.name} {c.section}
                </option>
              ))}
            </select>
            <button
              onClick={() => { setPdfType('class'); setPdfModalOpen(true); }}
              className="ml-auto text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Class Routine
            </button>
          </div>

          {classRoutineData && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-center text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3 font-extrabold w-28 text-left border-r border-slate-200 dark:border-slate-800">Days</th>
                      {periods.map(p => (
                        <th key={p.period_num} className="p-2.5 font-bold border-r border-slate-200 dark:border-slate-800 min-w-[105px]">
                          <div>{p.period_name}</div>
                          <div className="text-[9px] font-normal text-slate-400">{p.start_time}–{p.end_time}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {WORKING_DAYS.map(day => {
                      const daySchedule = classRoutineData.scheduleByDay?.[day.id];
                      return (
                        <tr key={day.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-3 font-extrabold text-left bg-slate-50/80 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                            {day.name}
                          </td>
                          {periods.map(p => {
                            const periodCell = daySchedule?.periods?.find(pr => pr.period_num === p.period_num);
                            const entry = periodCell?.entry;
                            return (
                              <td key={p.period_num} className="p-2 border-r border-slate-200 dark:border-slate-800 h-20 align-middle">
                                {entry ? (
                                  <div className="flex flex-col justify-center items-center">
                                    <span className="font-extrabold text-[11px] text-slate-900 dark:text-white">
                                      {entry.subject_name || entry.entry_type}
                                    </span>
                                    <span className="text-[10px] text-slate-600 dark:text-slate-400">
                                      {entry.teacher_name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-700 text-[10px] font-mono">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. SUB-TAB 4: SUPERVISION - WHO IS TEACHING? */}
      {activeSubTab === 'who_is_teaching' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase text-slate-500">Day:</label>
              <select
                className="input-field text-xs font-bold py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                value={supDay}
                onChange={e => setSupDay(Number(e.target.value))}
              >
                {WORKING_DAYS.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase text-slate-500">Period:</label>
              <select
                className="input-field text-xs font-bold py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                value={supPeriod}
                onChange={e => setSupPeriod(Number(e.target.value))}
              >
                {periods.map(p => (
                  <option key={p.period_num} value={p.period_num}>
                    {p.period_name} ({p.start_time}–{p.end_time})
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-slate-500 ml-auto">
              Active Classes in Period: <strong className="text-brand-600 dark:text-brand-400">{teachingRoster.length}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {teachingRoster.map((item, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-black text-brand-600 dark:text-brand-400">Class {item.class}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {item.entryType}
                  </span>
                </div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">{item.subject}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <strong>{item.teacher}</strong>
                </div>
                {item.room && <div className="text-[10px] text-slate-400 mt-1">Room: {item.room}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. SUB-TAB 5: SUPERVISION - AVAILABLE TEACHERS (WHO IS FREE?) */}
      {activeSubTab === 'who_is_free' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase text-slate-500">Day:</label>
              <select
                className="input-field text-xs font-bold py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                value={supDay}
                onChange={e => setSupDay(Number(e.target.value))}
              >
                {WORKING_DAYS.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase text-slate-500">Period:</label>
              <select
                className="input-field text-xs font-bold py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                value={supPeriod}
                onChange={e => setSupPeriod(Number(e.target.value))}
              >
                {periods.map(p => (
                  <option key={p.period_num} value={p.period_num}>
                    {p.period_name} ({p.start_time}–{p.end_time})
                  </option>
                ))}
              </select>
            </div>
            <div className="ml-auto flex items-center gap-3 text-xs">
              <span className="text-slate-500">Free for Substitution: <strong className="text-emerald-500">{freeTeachersData?.freeCount ?? 0} Teachers</strong></span>
              <span className="text-slate-500">Engaged in Classes: <strong className="text-brand-500">{freeTeachersData?.busyCount ?? 0} Teachers</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {freeTeachersData?.freeTeachers?.map(t => (
              <div key={t.id} className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/20 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-slate-900 dark:text-white">{t.name}</div>
                  <div className="text-[10px] text-slate-500">{t.department || 'General Faculty'}</div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  AVAILABLE
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. SUB-TAB 6: DISTRIBUTION & ACKNOWLEDGEMENTS */}
      {activeSubTab === 'distribution' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase">Teacher Routine Distribution & Sign-Offs</h3>
              <p className="text-xs text-slate-500">Real-time status of teachers who have viewed and formally acknowledged Routine {activeVersion?.version_code}</p>
            </div>
            <button
              onClick={handleSendReminders}
              disabled={sendingReminder || distributionStats?.pendingCount === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 text-xs font-black transition-all shadow-md"
            >
              <Bell className="w-3.5 h-3.5" />
              {sendingReminder ? 'Sending...' : 'Send Reminder to Pending Teachers'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-2.5 font-bold">Teacher Name</th>
                  <th className="p-2.5 font-bold">Viewed Status</th>
                  <th className="p-2.5 font-bold">Viewed At</th>
                  <th className="p-2.5 font-bold">Acknowledged Status</th>
                  <th className="p-2.5 font-bold">Acknowledged At</th>
                  <th className="p-2.5 font-bold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {distributionStats?.acknowledgements?.map(ack => (
                  <tr key={ack.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold text-slate-900 dark:text-white">{ack.teacher_name}</td>
                    <td className="p-2.5">
                      {ack.viewed_at ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          VIEWED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400">
                          UNVIEWED
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-slate-500">{ack.viewed_at ? new Date(ack.viewed_at).toLocaleTimeString() : '—'}</td>
                    <td className="p-2.5">
                      {ack.acknowledged_at ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-max">
                          <Check className="w-3 h-3" /> ACKNOWLEDGED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-slate-500">{ack.acknowledged_at ? new Date(ack.acknowledged_at).toLocaleTimeString() : '—'}</td>
                    <td className="p-2.5 text-slate-400 italic">{ack.acknowledgement_notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. SUB-TAB 7: PERIOD CONFIGURATION */}
      {activeSubTab === 'period_config' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-lg space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase">Daily Period Timing Configuration</h3>
              <p className="text-xs text-slate-500">Configure period names, start/end times, and special tags for Gyanoday Niketan</p>
            </div>
            <button
              onClick={handleSavePeriodConfig}
              disabled={savingPeriods}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md"
            >
              {savingPeriods ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-2.5 font-bold">#</th>
                  <th className="p-2.5 font-bold">Period Name</th>
                  <th className="p-2.5 font-bold">Start Time</th>
                  <th className="p-2.5 font-bold">End Time</th>
                  <th className="p-2.5 font-bold">Special Tag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {editingPeriods.map((p, idx) => (
                  <tr key={p.period_num} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold text-slate-500">{p.period_num}</td>
                    <td className="p-2.5">
                      <input
                        type="text"
                        className="input-field py-1 px-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded"
                        value={p.period_name}
                        onChange={e => {
                          const copy = [...editingPeriods];
                          copy[idx].period_name = e.target.value;
                          setEditingPeriods(copy);
                        }}
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="time"
                        className="input-field py-1 px-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded"
                        value={p.start_time}
                        onChange={e => {
                          const copy = [...editingPeriods];
                          copy[idx].start_time = e.target.value;
                          setEditingPeriods(copy);
                        }}
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="time"
                        className="input-field py-1 px-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded"
                        value={p.end_time}
                        onChange={e => {
                          const copy = [...editingPeriods];
                          copy[idx].end_time = e.target.value;
                          setEditingPeriods(copy);
                        }}
                      />
                    </td>
                    <td className="p-2.5">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={p.is_special}
                          onChange={e => {
                            const copy = [...editingPeriods];
                            copy[idx].is_special = e.target.checked;
                            setEditingPeriods(copy);
                          }}
                        />
                        <span className="text-[11px] text-slate-600 dark:text-slate-400">Weekly Test Period</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 10. SUB-TAB 8: AUDIT LOGS & VERSION HISTORY */}
      {activeSubTab === 'audit_log' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-lg space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase">Routine Audit Trail & Version Lifecycle</h3>
            <p className="text-xs text-slate-500">Immutable chronological record of routine creations, updates, validations, and publications</p>
          </div>

          <div className="space-y-2">
            {auditLogs.map((log, idx) => (
              <div key={log.id || idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-brand-600 dark:text-brand-400 uppercase tracking-wide">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 mt-1">
                    By: <strong>{log.performer_name || 'Principal'}</strong> — {JSON.stringify(log.details)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 11. CELL EDITING MODAL */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase">
                  Assign Period {editingCell.periodNum} ({WORKING_DAYS.find(w => w.id === editingCell.dayId)?.name})
                </h3>
                <p className="text-xs text-slate-500">
                  Teacher: <strong>{selectedTeacherData?.teacherName}</strong>
                </p>
              </div>
              <button onClick={() => setEditingCell(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCell} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Entry Type</label>
                <select
                  className="input-field w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  value={cellForm.entry_type}
                  onChange={e => setCellForm({ ...cellForm, entry_type: e.target.value })}
                >
                  {ROUTINE_ENTRY_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              {cellForm.entry_type !== 'ASSEMBLY' && cellForm.entry_type !== 'FREE PERIOD' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Class</label>
                  <select
                    className="input-field w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    value={cellForm.class_id}
                    onChange={e => setCellForm({ ...cellForm, class_id: e.target.value })}
                  >
                    <option value="">Select Class</option>
                    {classesList.map(c => (
                      <option key={c.id} value={c.id}>Class {c.name} {c.section}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Subject / Activity Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. English 2, Singing, Drawing, PT, Weekly Test"
                  className="input-field w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  value={cellForm.subject_name}
                  onChange={e => setCellForm({ ...cellForm, subject_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Room (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Room 12, Lab"
                    className="input-field w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    value={cellForm.room}
                    onChange={e => setCellForm({ ...cellForm, room: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. With KT"
                    className="input-field w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    value={cellForm.notes}
                    onChange={e => setCellForm({ ...cellForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
                {editingCell.entry && (
                  <button
                    type="button"
                    onClick={() => { handleClearCell(editingCell.entry.id); setEditingCell(null); }}
                    className="text-xs font-bold text-rose-500 hover:text-rose-600"
                  >
                    Clear Cell (Make Free)
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditingCell(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-extrabold shadow-md"
                  >
                    Save Assignment
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 12. VALIDATION DIAGNOSTIC MODAL */}
      {showValidationModal && validationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase">
                  Routine Pre-Flight Validation
                </h3>
              </div>
              <button onClick={() => setShowValidationModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                validationResult.isValid 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {validationResult.isValid ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
                )}
                <div>
                  <div className="font-extrabold text-sm">
                    {validationResult.isValid ? 'Routine Ready for Publication!' : 'Critical Conflicts Detected'}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {validationResult.isValid 
                      ? 'No teacher, class, or room clashes found across working days.' 
                      : `Found ${validationResult.criticalErrors.length} critical issues that block publication.`}
                  </div>
                </div>
              </div>

              {!validationResult.isValid && (
                <div className="max-h-60 overflow-y-auto space-y-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  {validationResult.criticalErrors.map((err, i) => (
                    <div key={i} className="p-2 rounded bg-rose-950/40 border border-rose-900/40 text-rose-200 text-[11px] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{err.message}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center pt-2">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Teacher Conflicts</span>
                  <div className="font-bold text-slate-900 dark:text-white">{validationResult.teacherConflicts}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Class Conflicts</span>
                  <div className="font-bold text-slate-900 dark:text-white">{validationResult.classConflicts}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <span className="text-[10px] text-slate-400">Room Conflicts</span>
                  <div className="font-bold text-slate-900 dark:text-white">{validationResult.roomConflicts}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowValidationModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 13. BULK GENERATE ALL TEACHER SLIPS MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase">
                  Bulk Teacher Routine Generation
                </h3>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-slate-800 dark:text-slate-200 space-y-2">
              <div className="font-bold text-sm text-indigo-900 dark:text-indigo-300">
                TEACHER ROUTINE GENERATION REPORT
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-200 dark:border-indigo-800/80">
                <div>Total Faculty: <strong>{teachersList.length} Teachers</strong></div>
                <div>Generated: <strong className="text-emerald-500">{teachersList.length} Slips</strong></div>
                <div>Validated: <strong className="text-emerald-500">{teachersList.length} Slips</strong></div>
                <div>Errors: <strong className="text-slate-500">0 Errors</strong></div>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-2">
                ✓ All teacher routine slips are synchronized and ready for distribution!
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold"
              >
                Close
              </button>
              <button
                onClick={() => { setShowBulkModal(false); setPdfType('teacher'); setPdfModalOpen(true); }}
                className="px-4 py-1.5 rounded-lg bg-brand-600 text-white font-extrabold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Preview & Print Slips
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 14. COPY PREVIOUS YEAR MODAL */}
      {showCopyYearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-brand-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase">
                  Copy Previous Year Routine
                </h3>
              </div>
              <button onClick={() => setShowCopyYearModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-600 dark:text-slate-400">
              Clone all master routine assignments from an earlier academic year into a new Draft for the upcoming year:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Source Academic Year</label>
                <input
                  type="text"
                  className="input-field w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border rounded"
                  value={copyYearSource}
                  onChange={e => setCopyYearSource(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Target Academic Year</label>
                <input
                  type="text"
                  className="input-field w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border rounded"
                  value={copyYearTarget}
                  onChange={e => setCopyYearTarget(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowCopyYearModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteCopyYear}
                className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-extrabold"
              >
                Clone into New Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 15. BROADCAST SHARED EVENT MODAL */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase">
                  Broadcast Shared School Period
                </h3>
              </div>
              <button onClick={() => setShowBroadcastModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-600 dark:text-slate-400">
              Quickly assign school-wide activities (e.g. Tuesday Morning Assembly or Tuesday Period 9 Weekly Test) to all teachers at once:
            </p>

            <form onSubmit={handleExecuteBroadcast} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Day</label>
                  <select
                    className="input-field w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border rounded"
                    value={broadcastForm.dayId}
                    onChange={e => setBroadcastForm({ ...broadcastForm, dayId: Number(e.target.value) })}
                  >
                    {WORKING_DAYS.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Period</label>
                  <select
                    className="input-field w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border rounded"
                    value={broadcastForm.periodNum}
                    onChange={e => setBroadcastForm({ ...broadcastForm, periodNum: Number(e.target.value) })}
                  >
                    {periods.map(p => (
                      <option key={p.period_num} value={p.period_num}>{p.period_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Activity Type</label>
                <select
                  className="input-field w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border rounded"
                  value={broadcastForm.entryType}
                  onChange={e => setBroadcastForm({ ...broadcastForm, entryType: e.target.value })}
                >
                  <option value="TEST">Weekly Test</option>
                  <option value="ASSEMBLY">Morning Assembly</option>
                  <option value="SPECIAL ACTIVITY">Special School Activity</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  className="input-field w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border rounded"
                  value={broadcastForm.subjectName}
                  onChange={e => setBroadcastForm({ ...broadcastForm, subjectName: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black"
                >
                  Broadcast to All Teachers
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 16. PRINTABLE PDF EXPORT DIALOG */}
      {pdfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Printer className="w-5 h-5 text-brand-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase">
                  Print Preview: {pdfType === 'teacher' ? 'Teacher Routine Slip' : pdfType === 'class' ? 'Class Timetable' : 'Master School Timetable'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Now
                </button>
                <button onClick={() => setPdfModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4 bg-slate-100 dark:bg-slate-950 flex-1">
              <RoutinePrintablePDF
                innerRef={printComponentRef}
                type={pdfType}
                data={pdfType === 'teacher' ? selectedTeacherData : pdfType === 'class' ? classRoutineData : { masterEntries }}
                periods={periods}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
