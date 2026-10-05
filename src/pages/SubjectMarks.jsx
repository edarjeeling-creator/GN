import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, Save, AlertCircle, CheckCircle2, Upload, Search, 
  Send, Lock, RefreshCw, AlertTriangle, ShieldCheck, Check, Info, FileText,
  Trophy, Copy, Printer, Frown, Sparkles, MessageCircle, CheckCheck, Calendar, Trash2,
  Plus, ChevronDown, ChevronRight, Download, X, Share2, ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatStudentDisplayName } from '../utils/studentUtils';
import { MarksCalculationEngine } from '../services/MarksCalculationEngine';
import { MarksWorkflowService } from '../services/MarksWorkflowService';
import { getStudentHouse, getHouseBadgeColor } from '../utils/houseData';
import { formatAssemblyDate, getTuesdayAssemblyReleaseDate } from '../utils/tuesdayAssemblySchedule';
import { getMostRecentTuesdayDate, formatConductedDate } from '../services/WeeklyTestReportService';
import { supabase } from '../lib/supabase';

// Normalize grade/standard name (e.g. "7", "Class 7", "Class 7A" -> "7")
export const getStandardKey = (clsObj) => {
  if (!clsObj) return '';
  let name = String(clsObj.name || '').trim().replace(/^class\s*/i, '').trim();
  if (clsObj.section && name.toLowerCase().endsWith(clsObj.section.toLowerCase())) {
    name = name.slice(0, -clsObj.section.length).trim();
  }
  return name.toLowerCase();
};

// Backward compatibility helper for legacy views, flowsheets, and reports
export const getConversionConstants = (className) => {
  if (!className) return { examConv: 75, testMax: 25 };
  const isHigher = /(^|\b|[^a-z0-9])(8|9|10|11|12|viii|ix|x|xi|xii)(?![0-9])/i.test(className);
  return isHigher ? { examConv: 80, testMax: 20 } : { examConv: 75, testMax: 25 };
};

const SubjectMarks = () => {
  const { classId, subjectId } = useParams();
  const navigate = useNavigate();
  const { classes, subjects, students, marks, attendance, academicYear } = useData();
  const { profile } = useAuth();

  const cls = classes.find(c => c.id === classId);
  const subject = subjects.find(s => s.id === subjectId);

  // Auto-populated authoritative student roster (No office requests needed)
  const classStudents = useMemo(() => 
    students.filter(s => s.class_id === classId || s.classId === classId).sort((a, b) => a.roll_no - b.roll_no),
  [students, classId]);

  const [selectedTerm, setSelectedTerm] = useState('Midterm');
  const [conductedDate, setConductedDate] = useState(() => getMostRecentTuesdayDate());
  const [patterns, setPatterns] = useState([]);
  const [activePattern, setActivePattern] = useState(null);
  const [patternsLoaded, setPatternsLoaded] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [loadingWorkflow, setLoadingWorkflow] = useState(true);

  // Authoritative Subject Display Name (Fallback safe, e.g. Computer Application)
  const subjectDisplayName = useMemo(() => {
    if (subject?.name && typeof subject.name === 'string' && subject.name.trim()) {
      return subject.name.trim();
    }
    const found = subjects.find(s => 
      String(s.id).toLowerCase() === String(subjectId).toLowerCase() || 
      (s.name && s.name.toLowerCase() === String(subjectId).toLowerCase()) ||
      (s.code && s.code.toLowerCase() === String(subjectId).toLowerCase())
    );
    if (found?.name && typeof found.name === 'string' && found.name.trim()) {
      return found.name.trim();
    }
    if (submission?.subject_name && typeof submission.subject_name === 'string' && submission.subject_name.trim()) {
      return submission.subject_name.trim();
    }
    if (activePattern?.subject_name && typeof activePattern.subject_name === 'string' && activePattern.subject_name.trim()) {
      return activePattern.subject_name.trim();
    }
    if (subjectId && subjectId !== 'undefined' && subjectId !== 'null') {
      const decoded = decodeURIComponent(String(subjectId)).replace(/[-_]/g, ' ').trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded)) {
        return decoded.replace(/\b\w/g, l => l.toUpperCase());
      }
    }
    return 'Computer Application';
  }, [subject, subjects, subjectId, submission, activePattern]);

  const localDraftKey = useMemo(() => 
    `gn_draft_marks_${classId}_${subjectId}_${academicYear}_${selectedTerm}`,
    [classId, subjectId, academicYear, selectedTerm]
  );
  const autoSaveTimerRef = useRef(null);

  // Local state for raw inputs and statuses:
  // rawScores: { `${studentId}_${componentCode}`: stringNumber }
  // statuses:  { `${studentId}_${componentCode}`: 'MARKED' | 'ABSENT' | 'NOT_APPLICABLE' }
  const [rawScores, setRawScores] = useState({});
  const [statuses, setStatuses] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [exportLoading, setExportLoading] = useState(null); // 'excel' | 'csv' | 'copy' | null
  const [exportSuccess, setExportSuccess] = useState(null); // 'excel' | 'csv' | 'copy' | null
  const [copySuccess, setCopySuccess] = useState(null); // 'cloud_url' | 'tsv' | null
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportModalData, setExportModalData] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const fileInputRef = useRef(null);

  // Dynamic Multiple Test Attempts State
  const [attempts, setAttempts] = useState([]); // array of assessment_attempts
  const [attemptScores, setAttemptScores] = useState({}); // { `${studentId}_${attemptId}`: string }
  const [attemptStatuses, setAttemptStatuses] = useState({}); // { `${studentId}_${attemptId}`: 'MARKED' | 'ABSENT' | 'NOT_APPLICABLE' }
  const [isWeeklyTestExpanded, setIsWeeklyTestExpanded] = useState(false);
  const [expandedStudentIds, setExpandedStudentIds] = useState({});

  // 1. Load assessment patterns and resolve active pattern
  useEffect(() => {
    let isMounted = true;
    const fetchPatterns = async () => {
      try {
        const list = await MarksWorkflowService.getAssessmentPatterns(academicYear);
        if (!isMounted) return;
        setPatterns(list);
        if (cls) {
          const matched = MarksCalculationEngine.resolvePattern(cls.name, academicYear, list, subjectDisplayName, cls.section);
          setActivePattern(matched);
        }
      } catch (err) {
        console.error('Error fetching patterns:', err);
      } finally {
        if (isMounted) setPatternsLoaded(true);
      }
    };
    fetchPatterns();
    return () => { isMounted = false; };
  }, [cls?.name, cls?.section, subjectDisplayName, academicYear]);

  // 2. Load submission status & detailed marks
  const loadSubmissionData = async () => {
    if (!cls || (!subject && !subjectDisplayName) || !profile?.id) return;
    setLoadingWorkflow(true);
    try {
      const sub = await MarksWorkflowService.getOrCreateSubmission({
        classId,
        subjectId,
        teacherId: profile.id,
        academicYear,
        term: selectedTerm,
        patternId: activePattern?.id
      });
      setSubmission(sub);

      if (sub?.test_date) {
        setConductedDate(sub.test_date);
      } else if (sub?.submission_notes) {
        const match = sub.submission_notes.match(/\[TestDate:\s*([0-9-]+)\]/);
        if (match) {
          setConductedDate(match[1]);
        }
      }

      if (sub?.id) {
        const details = await MarksWorkflowService.getSubmissionDetailedMarks(sub.id);
        const subAttempts = await MarksWorkflowService.getSubmissionAttemptsWithMarks(sub.id);

        const scoresMap = {};
        const statusMap = {};

        details.forEach(d => {
          const comp = activePattern?.components?.find(c => c.id === d.component_id);
          const code = comp ? comp.component_code : 'EXAM';
          const key = `${d.student_id}_${code}`;
          scoresMap[key] = d.raw_score !== null && d.raw_score !== undefined ? String(d.raw_score) : '';
          statusMap[key] = d.status || 'MARKED';
        });

        // Also check legacy marks for any pre-existing un-migrated values
        classStudents.forEach(st => {
          ['Exam', 'Test'].forEach(code => {
            const key = `${st.id}_${code.toUpperCase()}`;
            // If already marked ABSENT or NOT_APPLICABLE in detailed marks, DO NOT overwrite with legacy score!
            if ((scoresMap[key] === undefined || scoresMap[key] === '') && statusMap[key] !== 'ABSENT' && statusMap[key] !== 'NOT_APPLICABLE') {
              const legacyTermKey = `${st.id}_${subjectId}_${academicYear}_${selectedTerm}_${code}`;
              if (marks[legacyTermKey] !== undefined && marks[legacyTermKey] !== null) {
                scoresMap[key] = String(marks[legacyTermKey]);
                statusMap[key] = 'MARKED';
              }
            }
          });
        });

        // Initialize / Load attempts
        const testMax = MarksCalculationEngine.getClassWeeklyTestMaxMarks(cls?.name || '');
        const testComp = activePattern?.components?.find(c => c.component_code === 'TEST') || {
          id: 'c-test', component_code: 'TEST', component_name: 'Weekly Test', raw_max_marks: testMax
        };

        const attScoreMap = {};
        const attStatusMap = {};

        if (subAttempts && subAttempts.length > 0) {
          const activeAtts = subAttempts.filter(a => a.status !== 'DELETED');
          setAttempts(activeAtts);
          if (activeAtts.length > 1) {
            setIsWeeklyTestExpanded(true);
          }
          activeAtts.forEach(att => {
            (att.attempt_marks || []).forEach(m => {
              const k = `${m.student_id}_${att.id}`;
              attScoreMap[k] = m.score !== null && m.score !== undefined ? String(m.score) : '';
              attStatusMap[k] = m.status || 'MARKED';
            });
          });
        } else {
          // Initialize default Test 1 attempt for baseline single test
          const defaultAttId = `att_1_${sub.id}`;
          const defaultAttempt = {
            id: defaultAttId,
            submission_id: sub.id,
            component_id: testComp.id,
            attempt_number: 1,
            attempt_name: 'Test 1',
            test_date: sub.test_date || conductedDate || null,
            raw_max_marks: testComp.raw_max_marks || testMax,
            status: 'ACTIVE'
          };
          setAttempts([defaultAttempt]);

          // Seed Attempt 1 with existing Weekly Test marks
          classStudents.forEach(st => {
            const legacyVal = scoresMap[`${st.id}_TEST`];
            const legacySt = statusMap[`${st.id}_TEST`] || 'MARKED';
            const k = `${st.id}_${defaultAttId}`;
            if (legacySt === 'ABSENT' || legacySt === 'NOT_APPLICABLE' || (legacyVal !== undefined && legacyVal !== '')) {
              attScoreMap[k] = legacyVal !== undefined ? String(legacyVal) : '';
              attStatusMap[k] = legacySt;
            }
          });
        }

        // Check local storage for any unsaved changes that were entered before page refresh/exit
        try {
          const cachedStr = localStorage.getItem(localDraftKey);
          if (cachedStr) {
            const cached = JSON.parse(cachedStr);
            if (cached) {
              if (cached.attempts && Array.isArray(cached.attempts) && cached.attempts.length > 0) {
                setAttempts(cached.attempts);
                if (cached.attempts.length > 1) setIsWeeklyTestExpanded(true);
              }
              if (cached.attemptScores) {
                Object.assign(attScoreMap, cached.attemptScores);
              }
              if (cached.attemptStatuses) {
                Object.assign(attStatusMap, cached.attemptStatuses);
              }
              if (cached.rawScores) {
                let hasUnsavedLocal = false;
                Object.keys(cached.rawScores).forEach(k => {
                  const val = cached.rawScores[k];
                  if (val !== undefined && val !== '' && val !== scoresMap[k]) {
                    scoresMap[k] = val;
                    if (cached.statuses?.[k]) {
                      statusMap[k] = cached.statuses[k];
                    }
                    hasUnsavedLocal = true;
                  }
                });
                if (hasUnsavedLocal) {
                  console.log('Restored unsaved draft marks from device storage.');
                  setSaveStatus('pending');
                }
              }
            }
          }
        } catch (e) {
          console.warn('Local draft restore notice:', e);
        }

        setAttemptScores(attScoreMap);
        setAttemptStatuses(attStatusMap);
        setRawScores(scoresMap);
        setStatuses(statusMap);
      }
    } catch (err) {
      console.error('Failed to load submission data:', err);
    } finally {
      setLoadingWorkflow(false);
    }
  };

  useEffect(() => {
    if (!patternsLoaded) return;
    loadSubmissionData();
  }, [classId, subjectId, selectedTerm, academicYear, activePattern?.id, patternsLoaded]);

  // Read-only conditions: cannot edit when submitted, under review, approved, or locked
  const isReadOnly = useMemo(() => {
    if (!submission) return false;
    return ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'LOCKED'].includes(submission.status);
  }, [submission?.status]);

  // Components to render
  const components = useMemo(() => {
    if (activePattern?.components && activePattern.components.length > 0) {
      return [...activePattern.components].sort((a, b) => a.display_order - b.display_order);
    }
    // Default fallback pattern if database table is not yet populated
    const testMax = MarksCalculationEngine.getClassWeeklyTestMaxMarks(cls?.name || '');
    const examConvMax = 100 - testMax;
    return [
      { id: 'c-test', component_code: 'TEST', component_name: 'Weekly Test', raw_max_marks: testMax, converted_max_marks: testMax, display_order: 1 },
      { id: 'c-exam', component_code: 'EXAM', component_name: 'Term Examination', raw_max_marks: 100, converted_max_marks: examConvMax, display_order: 2 }
    ];
  }, [activePattern, cls?.name]);

  // Filter students based on language/elective assignment
  const eligibleSubjectStudents = useMemo(() => {
    return classStudents.filter(student => {
      const subName = subjectDisplayName.toLowerCase();
      if (subName.includes('2nd') || subName.includes('second')) return student.second_language ? subName.includes(student.second_language.toLowerCase()) : true;
      if (subName.includes('3rd') || subName.includes('third')) return student.third_language ? subName.includes(student.third_language.toLowerCase()) : true;
      if (subName.includes('elective') || subName.includes('evs/math') || subName.includes('maths/evs') || subName.includes('math/evs')) return student.elective_subject ? subName.includes(student.elective_subject.toLowerCase()) : true;
      if (subName.includes('6th') || subName.includes('sixth')) return student.sixth_subject ? subName.includes(student.sixth_subject.toLowerCase()) : true;
      return true;
    });
  }, [classStudents, subjectDisplayName]);

  // Display roster filtering (search box)
  const filteredStudents = useMemo(() => {
    if (!globalFilter) return eligibleSubjectStudents;
    const q = globalFilter.toLowerCase();
    return eligibleSubjectStudents.filter(student => {
      const matchesName = student.name?.toLowerCase().includes(q);
      const matchesRoll = String(student.roll_no).includes(q);
      return matchesName || matchesRoll;
    });
  }, [eligibleSubjectStudents, globalFilter]);

  // Calculate live attempt aggregates for each student
  const studentAttemptAggregates = useMemo(() => {
    const map = {};
    if (!attempts || attempts.length === 0) return map;
    const rule = activePattern?.rounding_rule || 'ROUND_2_DECIMALS';

    classStudents.forEach(st => {
      const studentScoresMap = {};
      attempts.forEach(att => {
        const k = `${st.id}_${att.id}`;
        studentScoresMap[att.id] = {
          score: attemptScores[k] !== undefined ? attemptScores[k] : '',
          status: attemptStatuses[k] || 'MARKED'
        };
      });

      map[st.id] = MarksCalculationEngine.aggregateAttempts({
        attempts,
        scores: studentScoresMap,
        roundingRule: rule,
        aggregationMethod: 'AVERAGE'
      });
    });
    return map;
  }, [classStudents, attempts, attemptScores, attemptStatuses, activePattern?.rounding_rule]);

  // Handle Raw Mark Input Change (Supports both legacy direct input and single attempt sync)
  const handleScoreChange = (studentId, componentCode, rawVal, maxRaw) => {
    if (isReadOnly) return;
    
    // Bounds validation
    if (rawVal !== '') {
      const num = Number(rawVal);
      if (isNaN(num)) return;
      if (num < 0) {
        alert('Marks cannot be negative.');
        return;
      }
      if (num > maxRaw) {
        alert(`Entered mark (${num}) exceeds maximum allowed marks (${maxRaw}).`);
        return;
      }
    }

    const key = `${studentId}_${componentCode}`;
    const nextScores = { ...rawScores, [key]: rawVal };
    const nextStatuses = { ...statuses, [key]: 'MARKED' };

    // Synchronize Attempt 1 if single-test mode
    let nextAttemptScores = attemptScores;
    let nextAttemptStatuses = attemptStatuses;
    if (componentCode === 'TEST' && attempts.length === 1) {
      const attKey = `${studentId}_${attempts[0].id}`;
      nextAttemptScores = { ...attemptScores, [attKey]: rawVal };
      nextAttemptStatuses = { ...attemptStatuses, [attKey]: 'MARKED' };
      setAttemptScores(nextAttemptScores);
      setAttemptStatuses(nextAttemptStatuses);
    }

    setRawScores(nextScores);
    setStatuses(nextStatuses);
    setSaveStatus('pending');

    // Immediately persist to local device storage as emergency backup
    try {
      localStorage.setItem(localDraftKey, JSON.stringify({
        rawScores: nextScores,
        statuses: nextStatuses,
        attempts,
        attemptScores: nextAttemptScores,
        attemptStatuses: nextAttemptStatuses,
        timestamp: Date.now()
      }));
    } catch (e) {}
  };

  // Handle Status Toggle (Marked / Absent / N/A)
  const handleStatusChange = (studentId, componentCode, newStatus) => {
    if (isReadOnly) return;
    const key = `${studentId}_${componentCode}`;
    const nextStatuses = { ...statuses, [key]: newStatus };
    const nextScores = { ...rawScores };
    if (newStatus !== 'MARKED') {
      nextScores[key] = '';
    }

    // Synchronize Attempt 1 if single-test mode
    let nextAttemptScores = attemptScores;
    let nextAttemptStatuses = attemptStatuses;
    if (componentCode === 'TEST' && attempts.length === 1) {
      const attKey = `${studentId}_${attempts[0].id}`;
      nextAttemptStatuses = { ...attemptStatuses, [attKey]: newStatus };
      nextAttemptScores = { ...attemptScores };
      if (newStatus !== 'MARKED') {
        nextAttemptScores[attKey] = '';
      }
      setAttemptStatuses(nextAttemptStatuses);
      setAttemptScores(nextAttemptScores);
    }

    setStatuses(nextStatuses);
    setRawScores(nextScores);
    setSaveStatus('pending');

    try {
      localStorage.setItem(localDraftKey, JSON.stringify({
        rawScores: nextScores,
        statuses: nextStatuses,
        attempts,
        attemptScores: nextAttemptScores,
        attemptStatuses: nextAttemptStatuses,
        timestamp: Date.now()
      }));
    } catch (e) {}
  };

  // Handle Individual Attempt Score Input
  const handleAttemptScoreChange = (studentId, attemptId, rawVal, maxRaw) => {
    if (isReadOnly) return;
    const validation = MarksCalculationEngine.validateAttemptMark(rawVal, maxRaw);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    const key = `${studentId}_${attemptId}`;
    const nextScores = { ...attemptScores, [key]: rawVal };
    const nextStatuses = { ...attemptStatuses, [key]: validation.status || 'MARKED' };

    setAttemptScores(nextScores);
    setAttemptStatuses(nextStatuses);
    setSaveStatus('pending');

    try {
      localStorage.setItem(localDraftKey, JSON.stringify({
        rawScores,
        statuses,
        attempts,
        attemptScores: nextScores,
        attemptStatuses: nextStatuses,
        timestamp: Date.now()
      }));
    } catch (e) {}
  };

  // Handle Individual Attempt Status Toggle (Marked / Absent / N/A)
  const handleAttemptStatusChange = (studentId, attemptId, newStatus) => {
    if (isReadOnly) return;
    const key = `${studentId}_${attemptId}`;
    const nextStatuses = { ...attemptStatuses, [key]: newStatus };
    const nextScores = { ...attemptScores };
    if (newStatus !== 'MARKED') {
      nextScores[key] = '';
    }

    setAttemptStatuses(nextStatuses);
    setAttemptScores(nextScores);
    setSaveStatus('pending');

    try {
      localStorage.setItem(localDraftKey, JSON.stringify({
        rawScores,
        statuses,
        attempts,
        attemptScores: nextScores,
        attemptStatuses: nextStatuses,
        timestamp: Date.now()
      }));
    } catch (e) {}
  };

  // Add New Test Attempt (e.g. Test 2, Test 3)
  const handleAddAttempt = () => {
    if (isReadOnly) return;
    const testMax = MarksCalculationEngine.getClassWeeklyTestMaxMarks(cls?.name || '');
    const testComp = components.find(c => c.component_code === 'TEST') || {
      id: 'c-test', raw_max_marks: testMax
    };

    const newNumber = attempts.length + 1;
    const newAttemptId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : `att_${newNumber}_${Date.now()}`;

    const newAttempt = {
      id: newAttemptId,
      submission_id: submission?.id,
      component_id: testComp.id,
      attempt_number: newNumber,
      attempt_name: `Test ${newNumber}`,
      test_date: conductedDate || new Date().toISOString().split('T')[0],
      raw_max_marks: testComp.raw_max_marks || testMax,
      status: 'ACTIVE'
    };

    const nextAttempts = [...attempts, newAttempt];
    setAttempts(nextAttempts);
    setIsWeeklyTestExpanded(true); // Automatically expand when a repeat test is added
    setSaveStatus('pending');

    try {
      localStorage.setItem(localDraftKey, JSON.stringify({
        rawScores,
        statuses,
        attempts: nextAttempts,
        attemptScores,
        attemptStatuses,
        timestamp: Date.now()
      }));
    } catch (e) {}
  };

  // Delete Test Attempt (only permitted in draft state)
  const handleDeleteAttempt = async (attemptToDelete) => {
    if (isReadOnly) return;
    if (attempts.length <= 1) {
      alert('At least one test attempt must remain.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${attemptToDelete.attempt_name}? This will remove all student marks entered for this test.`)) {
      return;
    }

    const filtered = attempts
      .filter(a => a.id !== attemptToDelete.id)
      .map((a, idx) => ({
        ...a,
        attempt_number: idx + 1,
        attempt_name: a.attempt_name.startsWith('Test ') ? `Test ${idx + 1}` : a.attempt_name
      }));

    const nextScores = { ...attemptScores };
    const nextStatuses = { ...attemptStatuses };
    Object.keys(nextScores).forEach(k => {
      if (k.endsWith(`_${attemptToDelete.id}`)) delete nextScores[k];
    });
    Object.keys(nextStatuses).forEach(k => {
      if (k.endsWith(`_${attemptToDelete.id}`)) delete nextStatuses[k];
    });

    setAttempts(filtered);
    setAttemptScores(nextScores);
    setAttemptStatuses(nextStatuses);
    setSaveStatus('pending');

    if (attemptToDelete.id && !attemptToDelete.id.startsWith('att_') && !attemptToDelete.id.startsWith('temp_')) {
      try {
        await MarksWorkflowService.deleteAssessmentAttempt(attemptToDelete.id);
      } catch (err) {
        console.warn('Notice deleting attempt from DB:', err.message || err);
      }
    }
  };

  // Update Test Attempt Date
  const handleAttemptDateChange = (attemptId, newDate) => {
    if (isReadOnly) return;
    const nextAttempts = attempts.map(a => a.id === attemptId ? { ...a, test_date: newDate } : a);
    setAttempts(nextAttempts);
    setSaveStatus('pending');
  };

  // Toggle student row expansion
  const toggleStudentExpanded = (studentId) => {
    setExpandedStudentIds(prev => ({ ...prev, [studentId]: !prev[studentId] }));
  };

  // Debounced Auto-Save Draft: triggers automatically 2.5 seconds after user stops typing
  useEffect(() => {
    if (saveStatus !== 'pending' || isReadOnly || !submission?.id) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveDraft(true);
    }, 2500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [rawScores, statuses, attempts, attemptScores, attemptStatuses, conductedDate, saveStatus, isReadOnly, submission?.id]);

  // Warn user if attempting to leave window/tab with unsaved marks
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (saveStatus === 'pending') {
        e.preventDefault();
        e.returnValue = 'You have unsaved entered marks! Please wait for auto-save or click Save Draft.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  // Sibling classes in the same grade (e.g., 7 A and 7 B)
  const siblingClasses = useMemo(() => {
    if (!cls || !classes?.length) return [];
    const stdKey = getStandardKey(cls);
    const matched = classes.filter(c => {
      const cKey = getStandardKey(c);
      return cKey === stdKey;
    }).sort((a, b) => (a.section || '').localeCompare(b.section || ''));
    return matched.length > 0 ? matched : [cls];
  }, [classes, cls]);

  const combinedSectionsLabel = useMemo(() => {
    if (!siblingClasses.length) return '';
    return siblingClasses.map(c => `${c.name} ${c.section}`.trim()).join(' & ');
  }, [siblingClasses]);

  // Generic authoritative calculator for any class section
  const computeSectionAssemblySummary = (targetCls, targetStudents, targetRawScores, targetStatuses, targetComponents, targetPattern) => {
    if (!targetCls || !targetStudents?.length || !targetComponents?.length) {
      return { topScorers: [], requiresAttention: [], absentees: [], totalEvaluated: 0, totalEligible: 0 };
    }

    const currentClassName = `${targetCls.name || ''} ${targetCls.section || ''}`.trim();

    const scoredStudents = targetStudents.map(student => {
      const studentScores = {};
      const studentStatuses = {};
      let hasAnyAbsent = false;
      let hasAnyNumericScore = false;

      targetComponents.forEach(comp => {
        let rawVal;
        let stStatus;

        if (comp.component_code === 'TEST' && targetCls?.id === classId && studentAttemptAggregates[student.id]) {
          const agg = studentAttemptAggregates[student.id];
          rawVal = agg?.aggregatedScore !== null && agg?.aggregatedScore !== undefined ? agg.aggregatedScore : '';
          stStatus = agg?.status || 'MARKED';
        } else {
          const key = `${student.id}_${comp.component_code}`;
          rawVal = targetRawScores[key];
          stStatus = targetStatuses[key] || 'MARKED';
        }

        const normStatus = String(stStatus || '').trim().toUpperCase();
        const normVal = String(rawVal !== null && rawVal !== undefined ? rawVal : '').trim().toUpperCase();

        const isAbsentEntry = normStatus === 'ABSENT' || normStatus === 'AB' || normStatus === 'ABS' ||
          normVal === 'AB' || normVal === 'A' || normVal === 'ABS' || normVal === 'ABSENT';

        if (isAbsentEntry) {
          hasAnyAbsent = true;
          stStatus = 'ABSENT';
          rawVal = '';
        } else if (normVal !== '' && !isNaN(Number(normVal))) {
          hasAnyNumericScore = true;
        }

        studentScores[comp.component_code] = rawVal;
        studentStatuses[comp.component_code] = stStatus;
      });

      // Also check daily attendance record for the test conducted date if available
      if (!hasAnyAbsent && !hasAnyNumericScore && conductedDate && attendance && Array.isArray(attendance)) {
        const attRec = attendance.find(a => 
          (a.student_id === student.id || a.studentId === student.id) && 
          String(a.date).slice(0, 10) === String(conductedDate).slice(0, 10)
        );
        if (attRec && String(attRec.status).toLowerCase() === 'absent') {
          hasAnyAbsent = true;
        }
      }

      const result = MarksCalculationEngine.calculateStudentResult({
        components: targetComponents,
        rawScores: studentScores,
        statuses: studentStatuses,
        gradeBoundaries: targetPattern?.grade_boundaries || [],
        roundingRule: targetPattern?.rounding_rule || 'ROUND_2_DECIMALS'
      });

      // A student is considered absent if they have an absent entry without positive score overrides,
      // or if calculation marked them as all-absent / grade AB.
      const isAbsent = (hasAnyAbsent && !hasAnyNumericScore) || result.isAllAbsent || result.grade === 'AB';
      
      // Skip students with completely blank marks who are not marked absent
      if (!result.hasAnyMark && !isAbsent) {
        return null;
      }

      const total = isAbsent ? 0 : (result.totalConverted !== null && result.totalConverted !== undefined ? result.totalConverted : 0);
      const house = student.house || getStudentHouse(student.name, currentClassName);

      return {
        student,
        total,
        isAbsent,
        house,
        grade: isAbsent ? 'AB' : result.grade
      };
    }).filter(Boolean);

    // Call single authoritative ranking and attention engine
    return MarksCalculationEngine.calculateHonoursAndAttention(scoredStudents, {
      rankingPolicy: 'DENSE',
      requiresAttentionThreshold: 10,
      thresholdType: 'SCORE',
      excludeAbsentFromRanking: true
    });
  };

  // Live calculation of 1st, 2nd, 3rd Rankers, Requires Attention, and Absentees for Current Section
  const assemblySummary = useMemo(() => {
    return computeSectionAssemblySummary(cls, eligibleSubjectStudents, rawScores, statuses, components, activePattern);
  }, [eligibleSubjectStudents, components, rawScores, statuses, activePattern, cls, attendance, conductedDate]);

  // State for sibling sections marks: { [classId]: { rawScores, statuses, pattern, components } }
  const [siblingMarksData, setSiblingMarksData] = useState({});

  useEffect(() => {
    let isMounted = true;
    const loadSiblingMarks = async () => {
      const otherClasses = siblingClasses.filter(c => c.id !== classId);
      if (!otherClasses.length || !subjectId) return;

      for (const sCls of otherClasses) {
        try {
          const sStudents = students.filter(s => s.class_id === sCls.id || s.classId === sCls.id);
          const sPattern = MarksCalculationEngine.resolvePattern(sCls.name, academicYear, patterns, subjectDisplayName, sCls.section) || activePattern;
          const sComponents = (sPattern?.components && sPattern.components.length > 0)
            ? [...sPattern.components].sort((a, b) => a.display_order - b.display_order)
            : components;

          // 1. Try fetching from class_subject_mark_submissions & student_marks_detailed
          const { data: sub } = await supabase
            .from('class_subject_mark_submissions')
            .select('*')
            .eq('class_id', sCls.id)
            .eq('subject_id', subjectId)
            .eq('academic_year', academicYear)
            .eq('term', selectedTerm)
            .maybeSingle();

          const sRawScores = {};
          const sStatuses = {};

          if (sub?.id) {
            const details = await MarksWorkflowService.getSubmissionDetailedMarks(sub.id);
            details.forEach(d => {
              const comp = sComponents.find(c => c.id === d.component_id);
              const code = comp ? comp.component_code : 'EXAM';
              const key = `${d.student_id}_${code}`;
              sRawScores[key] = d.raw_score !== null && d.raw_score !== undefined ? String(d.raw_score) : '';
              sStatuses[key] = d.status || 'MARKED';
            });
          }

          // 2. Fallback to DataContext legacy marks
          sStudents.forEach(st => {
            ['EXAM', 'TEST'].forEach(code => {
              const key = `${st.id}_${code}`;
              // If already marked ABSENT or NOT_APPLICABLE in detailed marks, DO NOT overwrite with legacy score!
              if ((sRawScores[key] === undefined || sRawScores[key] === '') && sStatuses[key] !== 'ABSENT' && sStatuses[key] !== 'NOT_APPLICABLE') {
                const termCode = code === 'EXAM' ? 'Exam' : 'Test';
                const legacyKey1 = `${st.id}_${subjectId}_${academicYear}_${selectedTerm}_${termCode}`;
                const legacyKey2 = `${st.id}_${subjectId}_${selectedTerm}_${termCode}`;
                const legacyScore = marks[legacyKey1] ?? marks[legacyKey2];
                if (legacyScore !== undefined && legacyScore !== null) {
                  sRawScores[key] = String(legacyScore);
                  sStatuses[key] = 'MARKED';
                }
              }
            });
          });

          // 3. Check localStorage draft for sibling section
          try {
            const draftKey = `gn_draft_marks_${sCls.id}_${subjectId}_${academicYear}_${selectedTerm}`;
            const cachedStr = localStorage.getItem(draftKey);
            if (cachedStr) {
              const cached = JSON.parse(cachedStr);
              if (cached?.rawScores) {
                Object.keys(cached.rawScores).forEach(k => {
                  const val = cached.rawScores[k];
                  if (val !== undefined && val !== '') {
                    sRawScores[k] = val;
                    if (cached.statuses?.[k]) sStatuses[k] = cached.statuses[k];
                  }
                });
              }
            }
          } catch (e) {}

          if (isMounted) {
            setSiblingMarksData(prev => ({
              ...prev,
              [sCls.id]: {
                rawScores: sRawScores,
                statuses: sStatuses,
                pattern: sPattern,
                components: sComponents
              }
            }));
          }
        } catch (err) {
          console.error(`Failed to load marks for sibling section ${sCls.name} ${sCls.section}:`, err);
        }
      }
    };

    loadSiblingMarks();
    return () => { isMounted = false; };
  }, [siblingClasses, classId, subjectId, selectedTerm, academicYear, patterns, activePattern, components, marks, students]);

  // Combined summaries across all sections of this standard (e.g. 7 A and 7 B)
  const allSectionSummaries = useMemo(() => {
    return siblingClasses.map(sCls => {
      const isCurrent = sCls.id === classId;
      if (isCurrent) {
        return {
          cls: sCls,
          isCurrent: true,
          summary: assemblySummary,
          studentCount: eligibleSubjectStudents.length
        };
      }

      const sData = siblingMarksData[sCls.id];
      const sStudents = students.filter(s => s.class_id === sCls.id || s.classId === sCls.id)
        .sort((a, b) => a.roll_no - b.roll_no);
      const filteredSecStudents = sStudents.filter(student => {
        const subName = subjectDisplayName.toLowerCase();
        if (subName.includes('2nd') || subName.includes('second')) return student.second_language ? subName.includes(student.second_language.toLowerCase()) : true;
        if (subName.includes('3rd') || subName.includes('third')) return student.third_language ? subName.includes(student.third_language.toLowerCase()) : true;
        if (subName.includes('elective') || subName.includes('evs/math') || subName.includes('maths/evs') || subName.includes('math/evs')) return student.elective_subject ? subName.includes(student.elective_subject.toLowerCase()) : true;
        if (subName.includes('6th') || subName.includes('sixth')) return student.sixth_subject ? subName.includes(student.sixth_subject.toLowerCase()) : true;
        return true;
      });

      const sPattern = sData?.pattern || MarksCalculationEngine.resolvePattern(sCls.name, academicYear, patterns, subjectDisplayName, sCls.section) || activePattern;
      const sComponents = sData?.components || components;
      const sRawScores = sData?.rawScores || {};
      const sStatuses = sData?.statuses || {};

      const summary = computeSectionAssemblySummary(sCls, filteredSecStudents, sRawScores, sStatuses, sComponents, sPattern);

      return {
        cls: sCls,
        isCurrent: false,
        summary,
        studentCount: filteredSecStudents.length
      };
    });
  }, [siblingClasses, classId, assemblySummary, filteredStudents, siblingMarksData, students, subjectDisplayName, academicYear, patterns, activePattern, components]);

  const [activePreviewTab, setActivePreviewTab] = useState('both');
  const [printSlipMode, setPrintSlipMode] = useState('both'); // 'single' | 'both'
  const [copiedAssembly, setCopiedAssembly] = useState(false);

  // Standardized text for WhatsApp and Clipboard
  const generateAssemblyText = (mode = activePreviewTab) => {
    const termLabel = selectedTerm === 'Midterm' ? 'Mid-Term Exam' : 'Final-Term Exam';
    const teacherName = profile?.name || 'Subject Teacher';
    const subjectName = subjectDisplayName;

    if (mode === 'both' && allSectionSummaries.length > 1) {
      let text = `🏫 *GYANODAY NIKETAN — TUESDAY ASSEMBLY HONOURS*
━━━━━━━━━━━━━━━━━━━━━━━━━
📅 *Term:* ${termLabel} ${academicYear}
🏫 *Classes:* ${combinedSectionsLabel}
📖 *Subject:* ${subjectName}
👨‍🏫 *Teacher:* ${teacherName}
━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      allSectionSummaries.forEach(({ cls: sCls, summary: sSummary }) => {
        const secLabel = `${sCls.name} ${sCls.section}`.trim();
        const topText = sSummary.topScorers.length === 0
          ? '  _(No marks entered yet)_'
          : sSummary.topScorers.map(s => {
              const medal = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : '🥉';
              const rankSuffix = s.rank === 1 ? '1st' : s.rank === 2 ? '2nd' : '3rd';
              const houseStr = s.house ? ` (${s.house})` : '';
              return `  ${medal} *${rankSuffix} Rank:* ${formatStudentDisplayName(s.student.name)}${houseStr} — *${s.total}*`;
            }).join('\n');

        const attText = sSummary.requiresAttention.length === 0
          ? '  • _None — All evaluated students scored ≥ 10._'
          : sSummary.requiresAttention.map(s => {
              const houseStr = s.house ? ` (${s.house})` : '';
              return `  • ${formatStudentDisplayName(s.student.name)}${houseStr} — *${s.total}* (Below 10)`;
            }).join('\n');

        text += `\n📌 *CLASS ${secLabel}*:
🏆 *TOP SCORERS*:
${topText}

⚠️ *REQUIRES ATTENTION*:
${attText}
`;
      });

      text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n_Sent via Gyanoday Niketan ERP_`;
      return text;
    }

    // Single section format
    const targetSummary = (mode !== 'both' && mode !== classId)
      ? (allSectionSummaries.find(s => s.cls.id === mode)?.summary || assemblySummary)
      : assemblySummary;
    const targetCls = (mode !== 'both' && mode !== classId)
      ? (siblingClasses.find(c => c.id === mode) || cls)
      : cls;
    const className = targetCls ? `${targetCls.name || ''} ${targetCls.section || ''}`.trim() : 'Class';

    const topText = targetSummary.topScorers.length === 0
      ? '_(No marks entered yet)_'
      : targetSummary.topScorers.map(s => {
          const medal = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : '🥉';
          const rankSuffix = s.rank === 1 ? '1st' : s.rank === 2 ? '2nd' : '3rd';
          const houseStr = s.house ? ` (${s.house})` : '';
          return `${medal} *${rankSuffix} Rank:* ${formatStudentDisplayName(s.student.name)}${houseStr} — *${s.total}*`;
        }).join('\n');

    const attText = targetSummary.requiresAttention.length === 0
      ? '• _None — All evaluated students scored ≥ 10._'
      : targetSummary.requiresAttention.map(s => {
          const houseStr = s.house ? ` (${s.house})` : '';
          return `• ${formatStudentDisplayName(s.student.name)}${houseStr} — *${s.total}* (Below 10)`;
        }).join('\n');

    return `🏫 *GYANODAY NIKETAN — TUESDAY ASSEMBLY HONOURS*
━━━━━━━━━━━━━━━━━━━━━━━━━
📅 *Term:* ${termLabel} ${academicYear}
🏫 *Class:* ${className}
📖 *Subject:* ${subjectName}
👨‍🏫 *Teacher:* ${teacherName}
━━━━━━━━━━━━━━━━━━━━━━━━━

🏆 *TOP SCORERS (Assembly Honours)*:
${topText}

⚠️ *REQUIRES ATTENTION*:
${attText}

━━━━━━━━━━━━━━━━━━━━━━━━━
_Sent via Gyanoday Niketan ERP_`;
  };

  const handleCopyAssembly = () => {
    const text = generateAssemblyText(activePreviewTab);
    navigator.clipboard.writeText(text);
    setCopiedAssembly(true);
    setTimeout(() => setCopiedAssembly(false), 2500);
  };

  const handleWhatsAppToPrincipal = () => {
    const text = generateAssemblyText(activePreviewTab);
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  // Safe print trigger that temporarily removes dark mode during print preview so background is pure white
  const triggerSafePrint = () => {
    const wasDark = document.documentElement.classList.contains('dark');
    const prevBg = document.documentElement.style.getPropertyValue('--bg-color');
    document.documentElement.style.setProperty('--bg-color', '#ffffff');
    document.documentElement.style.backgroundColor = '#ffffff';
    document.body.style.backgroundColor = '#ffffff';
    if (wasDark) document.documentElement.classList.remove('dark');

    const restoreDark = () => {
      document.documentElement.style.setProperty('--bg-color', prevBg || '');
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
      if (wasDark && !document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.add('dark');
      }
    };

    window.addEventListener('afterprint', restoreDark, { once: true });

    setTimeout(() => {
      window.print();
      setTimeout(restoreDark, 1000);
    }, 150);
  };

  // Print single current section podium slip
  const handlePrintAssemblySlip = () => {
    setPrintSlipMode('single');
    triggerSafePrint();
  };

  // Print both sections on ONE single page for Principal
  const handlePrintBothSections = () => {
    setPrintSlipMode('both');
    triggerSafePrint();
  };

  // Save Draft (Supports manual button click and automatic background auto-save)
  const handleSaveDraft = async (isAutoSave = false) => {
    if (!submission?.id || isReadOnly) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setSaveStatus('saving');
    try {
      const detailedPayload = [];
      const legacyPayload = [];

      // 1. Normalize attempts with valid UUIDs
      const validUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const testComp = components.find(c => c.component_code === 'TEST') || components[0];
      const normalizedAttempts = attempts.map((a, idx) => {
        let attId = a.id;
        if (!attId || !validUUIDRegex.test(attId)) {
          attId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
            ? crypto.randomUUID() 
            : `00000000-0000-4000-a000-${String(idx + 1).padStart(12, '0')}`;
        }
        return {
          ...a,
          id: attId,
          attempt_number: idx + 1,
          attempt_name: a.attempt_name || `Test ${idx + 1}`
        };
      });

      const attemptsPayload = normalizedAttempts.map(a => ({
        id: a.id,
        submission_id: submission.id,
        component_id: testComp.id,
        attempt_number: a.attempt_number,
        attempt_name: a.attempt_name,
        test_date: a.test_date || conductedDate || null,
        raw_max_marks: a.raw_max_marks,
        status: 'ACTIVE',
        created_by: profile?.id
      }));

      // 2. Prepare student attempt marks payload
      const attemptMarksPayload = [];
      normalizedAttempts.forEach(att => {
        classStudents.forEach(st => {
          // Look up mark using both new UUID and original attempt id
          const origAttempt = attempts.find(a => a.attempt_number === att.attempt_number);
          const kNew = `${st.id}_${att.id}`;
          const kOrig = origAttempt ? `${st.id}_${origAttempt.id}` : null;
          
          const rawVal = attemptScores[kNew] !== undefined ? attemptScores[kNew] : (kOrig && attemptScores[kOrig] !== undefined ? attemptScores[kOrig] : '');
          const stStatus = attemptStatuses[kNew] || (kOrig && attemptStatuses[kOrig]) || 'MARKED';

          if ((rawVal !== '' && rawVal !== null && rawVal !== undefined) || stStatus !== 'MARKED') {
            attemptMarksPayload.push({
              attempt_id: att.id,
              student_id: st.id,
              score: rawVal !== '' && rawVal !== null && rawVal !== undefined ? Number(rawVal) : null,
              status: stStatus,
              updated_at: new Date().toISOString()
            });
          }
        });
      });

      classStudents.forEach(st => {
        // Collect student scores and statuses for calculation
        const studentScores = {};
        const studentStatuses = {};
        components.forEach(comp => {
          let rawVal;
          let stStatus;

          if (comp.component_code === 'TEST' && normalizedAttempts.length > 0) {
            const agg = studentAttemptAggregates[st.id];
            rawVal = agg?.aggregatedScore !== null && agg?.aggregatedScore !== undefined ? agg.aggregatedScore : '';
            stStatus = agg?.status || 'MARKED';
          } else {
            const key = `${st.id}_${comp.component_code}`;
            rawVal = rawScores[key];
            stStatus = statuses[key] || 'MARKED';
          }

          studentScores[comp.component_code] = rawVal;
          studentStatuses[comp.component_code] = stStatus;
        });

        // Run authoritative ERP calculation for this student
        const calcResult = MarksCalculationEngine.calculateStudentResult({
          components,
          rawScores: studentScores,
          statuses: studentStatuses,
          gradeBoundaries: activePattern?.grade_boundaries || [],
          roundingRule: activePattern?.rounding_rule || 'ROUND_2_DECIMALS'
        });

        components.forEach(comp => {
          const key = `${st.id}_${comp.component_code}`;
          const compData = calcResult.componentBreakdown?.find(b => b.componentCode === comp.component_code);

          let rawVal;
          let stStatus;

          if (comp.component_code === 'TEST' && normalizedAttempts.length > 0) {
            const agg = studentAttemptAggregates[st.id];
            rawVal = agg?.aggregatedScore !== null && agg?.aggregatedScore !== undefined ? agg.aggregatedScore : null;
            stStatus = agg?.status || 'MARKED';
          } else {
            rawVal = comp.is_calculated ? compData?.rawScore : rawScores[key];
            stStatus = comp.is_calculated ? compData?.status : (statuses[key] || 'MARKED');
          }

          let converted = compData?.convertedScore;

          detailedPayload.push({
            studentId: st.id,
            componentId: comp.id,
            componentCode: comp.component_code,
            rawMaxMarks: comp.raw_max_marks,
            rawScore: rawVal !== '' && rawVal !== null && rawVal !== undefined ? Number(rawVal) : null,
            convertedScore: converted !== null && converted !== undefined ? Number(converted) : null,
            status: stStatus || 'MARKED'
          });

          // Sync with legacy format for compatibility
          if (comp.component_code === 'TEST' || comp.component_code === 'EXAM') {
            const legacyTerm = `${academicYear}_${selectedTerm}_${comp.component_code === 'TEST' ? 'Test' : 'Exam'}`;
            legacyPayload.push({
              student_id: st.id,
              subject_id: subjectId,
              term: legacyTerm,
              score: stStatus === 'ABSENT' ? 0 : (rawVal !== '' && rawVal !== undefined && rawVal !== null ? Number(rawVal) : null)
            });
          }
        });

        // For Economics 3-Test pattern:
        // TEST_AVG represents the Test mark. Sync to legacy ${academicYear}_${selectedTerm}_Test
        const avgCompData = calcResult.componentBreakdown?.find(b => b.componentCode === 'TEST_AVG');
        if (avgCompData) {
          const legacyTerm = `${academicYear}_${selectedTerm}_Test`;
          legacyPayload.push({
            student_id: st.id,
            subject_id: subjectId,
            term: legacyTerm,
            score: avgCompData.status === 'ABSENT' ? 0 : (avgCompData.rawScore !== null && avgCompData.rawScore !== undefined ? Number(avgCompData.rawScore) : null)
          });
        }
      });

      await MarksWorkflowService.saveDraftMarks({
        submissionId: submission.id,
        classId,
        subjectId,
        academicYear,
        term: selectedTerm,
        testDate: conductedDate,
        detailedMarksList: detailedPayload,
        legacyMarksPayload: legacyPayload,
        attemptsPayload,
        attemptMarksPayload
      });

      // Clear emergency device backup once synced to server
      try {
        localStorage.removeItem(localDraftKey);
      } catch (e) {}

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      console.error('Error saving draft:', err);
      setSaveStatus('error');
      if (!isAutoSave) {
        alert('Failed to save draft: ' + err.message);
      }
    }
  };

  // Clear entered marks
  const handleClearMarks = () => {
    if (isReadOnly) return;
    const confirmClear = window.confirm(
      `Are you sure you want to clear all entered marks for ${cls?.name || 'Class'} - ${subjectDisplayName}?\n\nThis will reset all mark inputs so you can enter fresh scores.`
    );
    if (!confirmClear) return;

    const clearedScores = {};
    const clearedStatuses = {};
    classStudents.forEach(st => {
      components.forEach(comp => {
        const key = `${st.id}_${comp.component_code}`;
        clearedScores[key] = '';
        clearedStatuses[key] = 'MARKED';
      });
    });

    setRawScores(clearedScores);
    setStatuses(clearedStatuses);
    setSaveStatus('pending');
    try {
      localStorage.removeItem(localDraftKey);
    } catch (e) {}
  };

  // Extract and format the complete export dataset from current roster
  const generateExportDataset = () => {
    if (!filteredStudents || filteredStudents.length === 0) {
      return null;
    }

    const exportRows = filteredStudents.map(student => {
      const studentScores = {};
      const studentStatuses = {};
      components.forEach(comp => {
        let rawVal;
        let stStatus;
        if (comp.component_code === 'TEST' && attempts.length > 0) {
          const agg = studentAttemptAggregates[student.id];
          rawVal = agg?.aggregatedScore !== null && agg?.aggregatedScore !== undefined ? agg.aggregatedScore : '';
          stStatus = agg?.status || 'MARKED';
        } else {
          const key = `${student.id}_${comp.component_code}`;
          rawVal = rawScores[key];
          stStatus = statuses[key] || 'MARKED';
        }
        studentScores[comp.component_code] = rawVal;
        studentStatuses[comp.component_code] = stStatus;
      });

      const result = MarksCalculationEngine.calculateStudentResult({
        components,
        rawScores: studentScores,
        statuses: studentStatuses,
        gradeBoundaries: activePattern?.grade_boundaries || [],
        roundingRule: activePattern?.rounding_rule || 'ROUND_2_DECIMALS'
      });

      const row = {
        'Roll No': student.roll_no,
        'Student Name': student.name
      };

      // If multiple test attempts exist, export individual attempt columns first
      if (attempts.length > 1) {
        attempts.forEach(att => {
          const attKey = `${student.id}_${att.id}`;
          const attScore = attemptScores[attKey];
          const attStatus = attemptStatuses[attKey] || 'MARKED';
          const attColHeader = `${att.attempt_name || `Test ${att.attempt_number}`} (Max ${att.raw_max_marks || 25})`;
          if (attStatus === 'ABSENT') {
            row[attColHeader] = 'AB';
          } else if (attStatus === 'NOT_APPLICABLE') {
            row[attColHeader] = 'NA';
          } else if (attScore !== '' && attScore !== null && attScore !== undefined) {
            row[attColHeader] = Number(attScore);
          } else {
            row[attColHeader] = '';
          }
        });
      }

      components.forEach(comp => {
        const key = `${student.id}_${comp.component_code}`;
        const compData = result.componentBreakdown?.find(b => b.componentCode === comp.component_code);
        let stStatus;
        let rawVal;

        if (comp.component_code === 'TEST' && attempts.length > 0) {
          const agg = studentAttemptAggregates[student.id];
          rawVal = agg?.aggregatedScore !== null && agg?.aggregatedScore !== undefined ? agg.aggregatedScore : null;
          stStatus = agg?.status || 'MARKED';
        } else {
          stStatus = comp.is_calculated ? compData?.status : (statuses[key] || 'MARKED');
          rawVal = comp.is_calculated ? compData?.rawScore : rawScores[key];
        }

        let colHeader = comp.is_calculated
          ? `${comp.component_name} (Auto Max ${comp.raw_max_marks})`
          : `${comp.component_name} (Max ${comp.raw_max_marks})`;

        if (comp.component_code === 'TEST' && attempts.length > 1) {
          colHeader = `${comp.component_name} (Average /${comp.raw_max_marks})`;
        }

        if (stStatus === 'ABSENT') {
          row[colHeader] = 'AB';
        } else if (stStatus === 'NOT_APPLICABLE') {
          row[colHeader] = 'NA';
        } else if (rawVal !== '' && rawVal !== null && rawVal !== undefined) {
          row[colHeader] = Number(rawVal);
        } else {
          row[colHeader] = '';
        }
      });

      row['Calculated Total'] = result.hasAnyMark ? (result.isAllAbsent ? 'AB' : (result.totalConverted ?? '')) : '';
      row['Grade'] = result.grade || '';

      return row;
    });

    // Prepare sanitized names for filenames and sheet names (stripping slashes and invalid chars)
    const safeClass = String(cls?.name || 'Class').replace(/[/\\?%*:|"<>]/g, '-').trim();
    const safeSec = cls?.section ? `_${String(cls.section).replace(/[/\\?%*:|"<>]/g, '-').trim()}` : '';
    const safeSub = String(subjectDisplayName || 'Subject').replace(/[/\\?%*:|"<>]/g, '-').trim();
    const safeTerm = String(selectedTerm || 'Term').replace(/[/\\?%*:|"<>]/g, '-').trim();
    const safeYr = String(academicYear || '2026').replace(/[/\\?%*:|"<>]/g, '-').trim();
    const baseName = `${safeClass}${safeSec}_${safeSub}_${safeTerm}_${safeYr}`.replace(/\s+/g, '_');

    const headers = exportRows.length > 0 ? Object.keys(exportRows[0]) : [];

    // TSV format for direct clipboard copy and paste into Excel / Sheets
    const tsvText = [
      headers.join('\t'),
      ...exportRows.map(row => headers.map(h => String(row[h] ?? '').replace(/[\t\n\r]/g, ' ')).join('\t'))
    ].join('\n');

    // SheetJS Workbook & Sheet
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    const sheetName = `${safeClass}_${safeSub}`.substring(0, 31).replace(/[/\\?*[\]:]/g, '_');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // CSV format
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const csvBlob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const csvDataUri = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvContent);

    // Excel format (.xlsx)
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const xlsxBlob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const xlsxDataUri = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + b64;

    return {
      exportRows,
      headers,
      count: exportRows.length,
      baseName,
      tsvText,
      csvContent,
      csvBlob,
      csvDataUri,
      wb,
      xlsxBlob,
      xlsxDataUri,
      b64
    };
  };

  // Multi-Platform File Downloader & Delivery Orchestrator
  const downloadExportedFile = async ({ fileName, blob, dataUri, workbook, csvContent, format, b64, dataset }) => {
    const isMobileDevice = typeof navigator !== 'undefined' && (
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '') || 
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
    );
    const isNativeApp = typeof window !== 'undefined' && (
      !!window.Capacitor?.isNativePlatform?.() || 
      !!window.GyanodayNative?.isNativeApp?.()
    );

    let downloadedDirectly = false;

    // Strategy 1: Native Android Bridge in Gyanoday APK (Writes directly to MediaStore / Downloads folder)
    if (typeof window !== 'undefined' && window.GyanodayNative && typeof window.GyanodayNative.saveAndDownloadFile === 'function' && b64) {
      try {
        const mime = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const handled = window.GyanodayNative.saveAndDownloadFile(b64, mime, fileName);
        if (handled) {
          downloadedDirectly = true;
        }
      } catch (nativeErr) {
        console.warn('Native bridge download failed, falling back:', nativeErr);
      }
    }

    // Strategy 2: Generate Cloud HTTPS Download URL via Supabase Storage
    // This solves Android WebView / Capacitor where in-memory blob: URLs are blocked from downloading.
    // An HTTPS URL triggers Android's native DownloadManager or opens the external browser (Chrome).
    let cloudDownloadUrl = dataset?.cloudUrl || null;
    if (!cloudDownloadUrl) {
      try {
        const uploadBlob = blob || (format === 'csv' ? dataset?.csvBlob : dataset?.xlsxBlob);
        if (uploadBlob && supabase?.storage) {
          const mime = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storagePath = `exports/${Date.now()}_${cleanFileName}`;
          
          const { error: uploadErr } = await supabase.storage
            .from('public-assets')
            .upload(storagePath, uploadBlob, {
              contentType: mime,
              cacheControl: '300',
              upsert: true
            });

          if (!uploadErr) {
            const { data: urlData } = supabase.storage
              .from('public-assets')
              .getPublicUrl(storagePath);
            cloudDownloadUrl = urlData?.publicUrl || null;
            if (dataset) {
              dataset.cloudUrl = cloudDownloadUrl;
            }
          }
        }
      } catch (cloudErr) {
        console.warn('Cloud storage export upload notice:', cloudErr);
      }
    }

    // If on Mobile or Native App, trigger Cloud Download URL
    if (cloudDownloadUrl) {
      try {
        // In Capacitor native app, opening with '_system' tells the OS to handle via system browser / DownloadManager
        if (typeof window !== 'undefined') {
          if (window.Capacitor?.isNativePlatform?.() || window.GyanodayNative?.isNativeApp?.()) {
            window.open(cloudDownloadUrl, '_system');
            downloadedDirectly = true;
          } else if (isMobileDevice) {
            // Mobile browser: create an anchor tag pointing to cloud URL
            const cloudLink = document.createElement('a');
            cloudLink.href = cloudDownloadUrl;
            cloudLink.download = fileName;
            cloudLink.target = '_blank';
            cloudLink.rel = 'noopener noreferrer';
            document.body.appendChild(cloudLink);
            cloudLink.click();
            setTimeout(() => {
              try { document.body.removeChild(cloudLink); } catch (e) {}
            }, 5000);
            downloadedDirectly = true;
          }
        }
      } catch (triggerErr) {
        console.warn('Triggering cloud URL notice:', triggerErr);
      }
    }

    // Strategy 3: Standard Browser Direct Download (SheetJS & Blob URL)
    // Works reliably on PC, Mac, Chromebook, and standard mobile browsers
    if (format === 'excel' && workbook && XLSX && typeof XLSX.writeFile === 'function') {
      try {
        XLSX.writeFile(workbook, fileName);
        downloadedDirectly = true;
      } catch (writeFileErr) {
        console.warn('XLSX.writeFile notice:', writeFileErr);
      }
    }

    if (blob && typeof window !== 'undefined' && window.URL && window.URL.createObjectURL) {
      try {
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        link.rel = 'noopener';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          try { document.body.removeChild(link); } catch (e) {}
          try { window.URL.revokeObjectURL(objectUrl); } catch (e) {}
        }, 60000);

        downloadedDirectly = true;
      } catch (blobErr) {
        console.warn('Blob URL download failed, checking Data URI fallback:', blobErr);
      }
    }

    // Strategy 4: Data URI Fallback
    if (!downloadedDirectly && dataUri) {
      try {
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = fileName;
        link.rel = 'noopener';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          try { document.body.removeChild(link); } catch (e) {}
        }, 5000);

        downloadedDirectly = true;
      } catch (uriErr) {
        console.warn('Data URI download failed:', uriErr);
      }
    }

    // On mobile devices or native apps, ALWAYS display the Export Modal as well
    // so the teacher has the persistent Cloud Download link, 1-tap table copy, and PDF print!
    if (dataset) {
      setExportModalData(dataset);
      if (isMobileDevice || isNativeApp) {
        setShowExportModal(true);
      }
    }

    return { 
      success: true, 
      method: downloadedDirectly ? 'downloaded' : 'modal_opened',
      cloudUrl: cloudDownloadUrl 
    };
  };

  // Export Marks to Excel (.xlsx) or CSV (.csv)
  const handleExportMarks = async (format = 'excel') => {
    if (!filteredStudents || filteredStudents.length === 0) {
      alert('No students found to export. If search filter is active, clear search first.');
      return;
    }

    setExportLoading(format);
    try {
      const dataset = generateExportDataset();
      if (!dataset) return;

      const fileName = format === 'csv' ? `${dataset.baseName}.csv` : `${dataset.baseName}.xlsx`;
      const blob = format === 'csv' ? dataset.csvBlob : dataset.xlsxBlob;
      const dataUri = format === 'csv' ? dataset.csvDataUri : dataset.xlsxDataUri;

      const result = await downloadExportedFile({
        fileName,
        blob,
        dataUri,
        workbook: dataset.wb,
        csvContent: dataset.csvContent,
        format,
        b64: dataset.b64,
        dataset
      });

      if (result.success) {
        setExportSuccess(format);
        setTimeout(() => setExportSuccess(null), 3000);
      } else {
        setExportModalData(dataset);
        setShowExportModal(true);
      }
    } catch (err) {
      console.error('Export Error:', err);
      alert('Failed to export marksheet: ' + err.message);
    } finally {
      setExportLoading(null);
    }
  };

  // Trigger direct download from the modal (using Cloud URL or native bridge)
  const handleTriggerDirectDownload = async (format = 'excel') => {
    const dataset = exportModalData || generateExportDataset();
    if (!dataset) return;

    const fileName = format === 'csv' ? `${dataset.baseName}.csv` : `${dataset.baseName}.xlsx`;
    const mime = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    // 1. Try Native Android Bridge if present in APK
    if (typeof window !== 'undefined' && window.GyanodayNative?.saveAndDownloadFile && dataset.b64) {
      try {
        const ok = window.GyanodayNative.saveAndDownloadFile(dataset.b64, mime, fileName);
        if (ok) {
          setExportSuccess(format);
          setTimeout(() => setExportSuccess(null), 3000);
          return;
        }
      } catch (e) {
        console.warn('Native bridge failed:', e);
      }
    }

    // 2. If Cloud URL is ready, open it directly via _system and invisible anchor
    if (dataset.cloudUrl) {
      try {
        window.open(dataset.cloudUrl, '_system');
      } catch (e) {}
      const a = document.createElement('a');
      a.href = dataset.cloudUrl;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch (err) {}
      }, 5000);
      setExportSuccess(format);
      setTimeout(() => setExportSuccess(null), 3000);
      return;
    }

    // 3. Otherwise re-run handleExportMarks to upload to Cloud & trigger download
    await handleExportMarks(format);
  };

  // 1-Tap Copy Marksheet to Clipboard (Universal support across all phones and browsers)
  const handleCopyMarksTable = async () => {
    if (!filteredStudents || filteredStudents.length === 0) {
      alert('No students found to copy. If search filter is active, clear search first.');
      return;
    }
    setExportLoading('copy');
    try {
      const dataset = generateExportDataset();
      if (!dataset) return;

      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(dataset.tsvText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = dataset.tsvText;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setExportSuccess('copy');
      setTimeout(() => setExportSuccess(null), 3000);
      alert(`✓ Copied ${dataset.count} student records to clipboard!\n\nYou can now paste directly into Microsoft Excel, Google Sheets, or WhatsApp.`);
    } catch (err) {
      console.error('Copy table error:', err);
      alert('Could not copy to clipboard: ' + err.message);
    } finally {
      setExportLoading(null);
    }
  };

  // Backward compatibility alias
  const handleExportExcel = () => handleExportMarks('excel');

  // Import Marks from Excel
  const handleImportExcel = (e) => {
    if (isReadOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws);

        if (!rows || rows.length === 0) {
          alert('No data rows found in the uploaded Excel file.');
          return;
        }

        let updatedCount = 0;
        const newRawScores = { ...rawScores };
        const newStatuses = { ...statuses };
        const newAttemptScores = { ...attemptScores };
        const newAttemptStatuses = { ...attemptStatuses };

        rows.forEach(row => {
          // Find student by roll_no or name
          const rollVal = row['Roll No'] !== undefined ? row['Roll No'] : row['Roll'] !== undefined ? row['Roll'] : row['RollNo'];
          const nameVal = row['Student Name'] !== undefined ? row['Student Name'] : row['Name'];

          const student = classStudents.find(st => {
            if (rollVal !== undefined && rollVal !== null && rollVal !== '') {
              return String(st.roll_no).trim() === String(rollVal).trim();
            }
            if (nameVal) {
              return String(st.name).trim().toLowerCase() === String(nameVal).trim().toLowerCase();
            }
            return false;
          });

          if (!student) return;

          let studentUpdated = false;

          // 1. Check individual attempts if multiple attempts exist
          if (attempts.length > 0) {
            attempts.forEach(att => {
              const attNameNorm = (att.attempt_name || `test${att.attempt_number}`).toLowerCase().replace(/[^a-z0-9]/g, '');
              const possibleCols = Object.keys(row).filter(k => {
                const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                return normK.includes(attNameNorm) || (attempts.length === 1 && (normK.includes('weeklytest') || normK.includes('test')));
              });

              if (possibleCols.length > 0) {
                const rawCell = row[possibleCols[0]];
                const attKey = `${student.id}_${att.id}`;
                if (rawCell !== undefined && rawCell !== null && rawCell !== '') {
                  const strCell = String(rawCell).trim().toUpperCase();
                  if (strCell === 'AB' || strCell === 'ABS' || strCell === 'ABSENT' || strCell === 'A') {
                    newAttemptStatuses[attKey] = 'ABSENT';
                    newAttemptScores[attKey] = '';
                    studentUpdated = true;
                  } else if (strCell === 'NA' || strCell === 'N/A') {
                    newAttemptStatuses[attKey] = 'NOT_APPLICABLE';
                    newAttemptScores[attKey] = '';
                    studentUpdated = true;
                  } else {
                    const num = Number(rawCell);
                    if (!isNaN(num) && num >= 0) {
                      const clamped = Math.min(num, Number(att.raw_max_marks || 25));
                      newAttemptScores[attKey] = String(clamped);
                      newAttemptStatuses[attKey] = 'MARKED';
                      studentUpdated = true;
                    }
                  }
                }
              }
            });
          }

          components.forEach(comp => {
            // NEVER import calculated columns (e.g. TEST_AVG) - always recalculate!
            if (comp.is_calculated) return;

            // If TEST and we have attempts, attempt processing above handled or will handle it
            if (comp.component_code === 'TEST' && attempts.length > 0) return;

            // Look for matching column in row
            const possibleCols = Object.keys(row).filter(k => {
              const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              const normCompCode = comp.component_code.toLowerCase().replace(/[^a-z0-9]/g, '');
              const normCompName = comp.component_name.toLowerCase().replace(/[^a-z0-9]/g, '');
              return normK.includes(normCompCode) || normK.includes(normCompName);
            });

            if (possibleCols.length > 0) {
              const rawCell = row[possibleCols[0]];
              const key = `${student.id}_${comp.component_code}`;

              if (rawCell !== undefined && rawCell !== null && rawCell !== '') {
                const strCell = String(rawCell).trim().toUpperCase();
                if (strCell === 'AB' || strCell === 'ABS' || strCell === 'ABSENT' || strCell === 'A') {
                  newStatuses[key] = 'ABSENT';
                  newRawScores[key] = '';
                  studentUpdated = true;
                } else if (strCell === 'NA' || strCell === 'N/A') {
                  newStatuses[key] = 'NOT_APPLICABLE';
                  newRawScores[key] = '';
                  studentUpdated = true;
                } else {
                  const num = Number(rawCell);
                  if (!isNaN(num) && num >= 0) {
                    const clamped = Math.min(num, Number(comp.raw_max_marks));
                    newRawScores[key] = String(clamped);
                    newStatuses[key] = 'MARKED';
                    studentUpdated = true;
                  }
                }
              }
            }
          });

          if (studentUpdated) {
            updatedCount++;
          }
        });

        if (updatedCount > 0) {
          setRawScores(newRawScores);
          setStatuses(newStatuses);
          setAttemptScores(newAttemptScores);
          setAttemptStatuses(newAttemptStatuses);
          setSaveStatus('pending');
          alert(`Successfully imported marks for ${updatedCount} students. Calculated fields (including Test Average) have been automatically recomputed. Click "Save Draft" to save changes.`);
        } else {
          alert('Could not match any rows with students in this class. Please ensure Roll No or Student Name columns match the roster.');
        }
      } catch (err) {
        console.error('Excel Import Error:', err);
        alert('Failed to parse Excel file: ' + err.message);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsBinaryString(file);
  };

  // Submit to Coordinator Review
  const handleSubmitForReview = async () => {
    if (!submission?.id) return;
    if (isReadOnly) return;

    // Check if any mark is entered
    const hasEnteredAny = Object.values(rawScores).some(v => v !== '' && v !== null && v !== undefined);
    const hasAnyAbsent = Object.values(statuses).some(s => s === 'ABSENT');
    if (!hasEnteredAny && !hasAnyAbsent) {
      alert('Cannot submit an empty marksheet. Please enter student marks first.');
      return;
    }

    const confirmMsg = `Submit marks for ${cls?.name} - ${subjectDisplayName} (${selectedTerm}) to Coordinator Sir for verification?\n\nOnce submitted, you will not be able to modify these marks unless the Coordinator returns them for correction.`;
    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // 1. Auto-save latest changes first
      await handleSaveDraft();

      // 2. Call server RPC
      await MarksWorkflowService.submitForReview({
        submissionId: submission.id,
        notes: `[TestDate: ${conductedDate}] Submitted by ${profile?.name || 'Teacher'} on ${new Date().toLocaleDateString()}`
      });

      alert('Marks submitted successfully to Coordinator Sir for verification.');
      await loadSubmissionData();
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitError(err.message);
      alert('Error submitting marks: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <div className="no-print space-y-6">
        {/* Top Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/classes')}
            className="text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-750"
          >
            <ArrowLeft size={18} className="mr-1" /> Back to Classes
          </Button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {cls?.name} — {subjectDisplayName}
            </h1>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              Authoritative Student Marks Entry & Automated ERP Calculation
            </p>
          </div>
        </div>

        {/* Term Switcher */}
        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-700">
          {['Midterm', 'Finalterm'].map(t => (
            <button
              key={t}
              onClick={() => setSelectedTerm(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedTerm === t 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {t === 'Midterm' ? 'Mid-Term Exam' : 'Final-Term Exam'}
            </button>
          ))}
        </div>
      </div>

      {/* Test Conducted Date Banner */}
      <div className="p-3.5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-slate-900/90 to-slate-900 text-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0">
            <Calendar size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white tracking-wide">Test Conducted Date:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                {formatConductedDate(conductedDate)}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
              Assessment date for this weekly test. Whichever test conducted date is latest displays on the Senior School Weekly Report.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <input
            type="date"
            value={conductedDate}
            disabled={isReadOnly}
            onChange={e => {
              setConductedDate(e.target.value);
              setSaveStatus('pending');
            }}
            className="bg-slate-950 text-white font-medium px-3 py-1.5 rounded-xl border border-slate-700 text-xs focus:outline-none focus:border-amber-400 cursor-pointer disabled:opacity-50"
          />
          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => {
              const lastTue = getMostRecentTuesdayDate();
              setConductedDate(lastTue);
              setSaveStatus('pending');
            }}
            title="Snap to last Tuesday (22/09/2026)"
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            Last Tue (22/09)
          </button>
        </div>
      </div>

      {/* Tuesday Assembly Schedule Notice for Final Term */}
      {selectedTerm === 'Finalterm' && (
        <div className="p-3.5 rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/70 via-slate-900/80 to-blue-950/70 text-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-lg backdrop-blur-md">
          <div className="flex items-start md:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex-shrink-0">
              <Calendar size={20} />
            </div>
            <div className="text-xs">
              <div className="flex items-center gap-2 font-bold text-white tracking-wide">
                <span>Tuesday Morning Assembly Schedule (Final Term)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-medium">
                  Student Release Policy
                </span>
              </div>
              <p className="text-slate-300 mt-0.5 leading-relaxed">
                Final term marks reflect <strong>immediately</strong> on Principal and Teacher portals. For students, marks will only reflect on <strong>Tuesday during Morning Assembly</strong>. Any marks posted after Tuesday will reflect for students on the <strong>next Tuesday Assembly</strong>.
              </p>
            </div>
          </div>
          <div className="flex flex-col md:items-end text-left md:text-right flex-shrink-0 text-xs border-t md:border-t-0 pt-2 md:pt-0 border-indigo-500/20">
            <span className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Scheduled Student Release:</span>
            <span className="font-bold text-white font-mono text-[11px] bg-indigo-900/50 px-2.5 py-1 rounded-md border border-indigo-400/30 mt-0.5">
              {formatAssemblyDate(getTuesdayAssemblyReleaseDate())}
            </span>
          </div>
        </div>
      )}

      {/* Workflow Status Banner */}
      {submission && (
        <div className={`p-4 pb-3.5 rounded-2xl border transition-all workflow-scrollbar ${
          submission.status === 'LOCKED'
            ? 'bg-slate-900 border-slate-700 text-white'
            : submission.status === 'APPROVED'
            ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-100'
            : submission.status === 'RETURNED_FOR_CORRECTION'
            ? 'bg-rose-950/50 border-rose-500/50 text-rose-100'
            : submission.status === 'SUBMITTED' || submission.status === 'RESUBMITTED'
            ? 'bg-amber-950/50 border-amber-500/50 text-amber-100'
            : 'bg-blue-950/50 border-blue-500/50 text-blue-100'
        }`}>
          <div className="w-full flex items-center justify-between gap-4 min-w-max">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${
                submission.status === 'LOCKED' ? 'bg-slate-800 text-amber-400 border border-slate-700' :
                submission.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                submission.status === 'RETURNED_FOR_CORRECTION' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                submission.status === 'SUBMITTED' || submission.status === 'RESUBMITTED' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {submission.status === 'LOCKED' ? <Lock size={20} /> :
                 submission.status === 'APPROVED' ? <CheckCircle2 size={20} /> :
                 submission.status === 'RETURNED_FOR_CORRECTION' ? <AlertTriangle size={20} /> :
                 <ShieldCheck size={20} />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs uppercase tracking-wider font-bold text-slate-300 whitespace-nowrap">Workflow State:</span>
                  <span className="font-mono font-black text-xs px-2.5 py-1 rounded-md bg-slate-800 text-white border border-slate-700 whitespace-nowrap">
                    {submission.status}
                  </span>
                  {!isReadOnly && (
                    saveStatus === 'pending' ? (
                      <span className="text-[11px] font-medium text-amber-300 flex items-center gap-1.5 bg-amber-950/70 border border-amber-500/40 px-2 py-0.5 rounded-md whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                        Unsaved (Auto-saving...)
                      </span>
                    ) : saveStatus === 'saving' ? (
                      <span className="text-[11px] font-medium text-blue-300 flex items-center gap-1.5 bg-blue-950/70 border border-blue-500/40 px-2 py-0.5 rounded-md whitespace-nowrap">
                        <RefreshCw size={11} className="animate-spin text-blue-400" />
                        Saving draft...
                      </span>
                    ) : saveStatus === 'saved' ? (
                      <span className="text-[11px] font-medium text-emerald-300 flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-500/40 px-2 py-0.5 rounded-md whitespace-nowrap">
                        <Check size={12} className="text-emerald-400" />
                        Draft Saved
                      </span>
                    ) : null
                  )}
                </div>
                <p className="text-xs mt-1 text-slate-300 max-w-[320px] sm:max-w-md">
                  {submission.status === 'DRAFT' && 'You can enter raw marks and save drafts. When ready, submit to Coordinator Sir.'}
                  {(submission.status === 'SUBMITTED' || submission.status === 'RESUBMITTED') && 'Marks submitted. Awaiting Coordinator verification and approval.'}
                  {submission.status === 'APPROVED' && 'Approved by Coordinator. Awaiting formal locking for report card printing.'}
                  {submission.status === 'LOCKED' && 'Marks locked by Coordinator. Official report card printing is enabled.'}
                  {submission.status === 'RETURNED_FOR_CORRECTION' && 'Returned for correction. Please review the Coordinator note below, make changes, and resubmit.'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {!isReadOnly && (
                <>
                  <button 
                    type="button"
                    onClick={handleClearMarks}
                    disabled={isReadOnly}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                    title="Clear all student marks in this marksheet"
                  >
                    <Trash2 size={14} />
                    <span>Clear Marks</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleSaveDraft(false)}
                    disabled={saveStatus === 'saving'}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0 ${
                      saveStatus === 'pending'
                        ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-amber-500/20 shadow-md'
                        : saveStatus === 'saved'
                        ? 'bg-emerald-800 text-emerald-100 border-emerald-600'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600'
                    }`}
                  >
                    {saveStatus === 'saving' ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : saveStatus === 'saved' ? (
                      <>
                        <Check size={14} className="text-emerald-300" />
                        <span>Draft Saved</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} className={saveStatus === 'pending' ? 'text-amber-200' : ''} />
                        <span>{saveStatus === 'pending' ? 'Save Draft *' : 'Save Draft'}</span>
                      </>
                    )}
                  </button>
                  <button 
                    type="button"
                    onClick={handleSubmitForReview}
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Send size={14} />
                    <span>{isSubmitting ? 'Submitting...' : 'Submit to Coordinator'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Return Reason Alert (If returned for correction) */}
      {submission?.status === 'RETURNED_FOR_CORRECTION' && submission.return_reason && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500 text-rose-100 space-y-1 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-300">
            <AlertTriangle size={16} /> Coordinator's Correction Request:
          </div>
          <p className="text-sm font-medium pl-6 leading-relaxed text-rose-200">
            "{submission.return_reason}"
          </p>
        </div>
      )}

      {/* Assessment Pattern Information Card */}
      {!activePattern ? (
        <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500 text-amber-100 flex items-center gap-3 shadow-md">
          <AlertTriangle size={24} className="text-amber-400 shrink-0" />
          <div>
            <div className="font-bold text-sm text-amber-300">
              Assessment configuration incomplete. Please contact Administrator.
            </div>
            <p className="text-xs text-amber-200 mt-0.5">
              No active assessment scheme or component rules found for this class and academic year. Evaluation conversions and grading cannot proceed without administrative configuration.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40">
                <Info size={18} />
              </div>
              <div>
                <div className="font-bold text-white text-sm flex items-center gap-1.5">
                  Active Assessment Pattern: <span className="text-blue-300 font-semibold">{activePattern.pattern_name}</span> <span className="text-xs text-slate-400 font-normal">(v{activePattern.version || 1})</span>
                </div>
                <p className="text-slate-300 mt-1 font-medium">
                  Components:{' '}
                  {components.map(c => `${c.component_name} (Raw Max: ${c.raw_max_marks} → Converted: ${c.converted_max_marks})`).join(' | ')}
                </p>
              </div>
            </div>
            <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold shadow-inner">
              <ShieldCheck size={14} className="text-emerald-400" />
              Formula: Converted = Raw × ConvertedMax / RawMax
            </div>
          </div>
        </div>
      )}

      {/* Weekly Test Attempts Management Bar */}
      {attempts.length > 0 && (
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-md space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <span className="text-emerald-400 font-extrabold text-sm">{isWeeklyTestExpanded ? '▼' : '▶'}</span>
                <span>Weekly Test Attempts ({attempts.length}):</span>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {attempts.map(att => (
                  <div key={att.id} className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-700 shadow-inner">
                    <span className="font-bold text-white text-xs">{att.attempt_name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">/{att.raw_max_marks}</span>
                    <input
                      type="date"
                      disabled={isReadOnly}
                      value={att.test_date || ''}
                      onChange={e => handleAttemptDateChange(att.id, e.target.value)}
                      title={`Date for ${att.attempt_name}`}
                      className="bg-slate-900 px-1.5 py-0.5 rounded text-[11px] text-slate-300 border border-slate-700 focus:outline-none focus:border-indigo-400 font-mono"
                    />
                    {!isReadOnly && attempts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAttempt(att)}
                        className="text-slate-500 hover:text-rose-400 p-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
                        title={`Delete ${att.attempt_name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleAddAttempt}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  title="Add a repeat test attempt for this assessment period"
                >
                  <Plus size={14} />
                  <span>Add Test</span>
                </button>
              )}
              {attempts.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsWeeklyTestExpanded(!isWeeklyTestExpanded)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                >
                  {isWeeklyTestExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>{isWeeklyTestExpanded ? 'Collapse All' : 'Expand All'}</span>
                </button>
              )}
            </div>
          </div>
          {attempts.length > 1 && (
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Info size={12} className="text-indigo-400 shrink-0" />
              <span>Multi-Test Active: Official Weekly Test mark is calculated as arithmetic average of valid entered attempts. Empty tests and AB/NA are handled automatically.</span>
            </div>
          )}
        </div>
      )}

      {/* Student Marks Table */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl">
        {/* Student Roster Header & Responsive Action Toolbar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-900 space-y-3">
          {/* Top row: Title and student counter */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Student Roster</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {filteredStudents.length} {filteredStudents.length === 1 ? 'Student' : 'Students Enrolled'}
              </span>
            </h2>
          </div>

          {/* Controls: Responsive Search + Swipeable Horizontal Action Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input: full width on mobile, constrained on desktop */}
            <div className="relative w-full md:w-72 shrink-0">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
                placeholder="Search student or roll no..."
                className="w-full pl-9 pr-8 py-2 md:py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium transition-all shadow-inner"
              />
              {globalFilter && (
                <button
                  type="button"
                  onClick={() => setGlobalFilter('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Horizontal Scrollable Action Toolbar with Right Fade Indicator on Mobile */}
            <div className="relative min-w-0 max-w-full">
              <div 
                className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 flex-nowrap touch-pan-x"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {/* 1. Export Excel Button */}
                <button
                  type="button"
                  onClick={() => handleExportMarks('excel')}
                  disabled={!!exportLoading}
                  className={`px-3 py-2 md:py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 whitespace-nowrap active:scale-95 ${
                    exportSuccess === 'excel'
                      ? 'bg-emerald-800 text-emerald-100 border-emerald-600'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title="Export current marksheet to Excel (.xlsx)"
                >
                  {exportLoading === 'excel' ? (
                    <RefreshCw size={13} className="animate-spin text-emerald-400" />
                  ) : exportSuccess === 'excel' ? (
                    <Check size={13} className="text-emerald-300" />
                  ) : (
                    <FileText size={13} className="text-emerald-400" />
                  )}
                  <span>{exportSuccess === 'excel' ? 'Exported!' : 'Export Excel'}</span>
                </button>

                {/* 2. Export CSV Button */}
                <button
                  type="button"
                  onClick={() => handleExportMarks('csv')}
                  disabled={!!exportLoading}
                  className={`px-3 py-2 md:py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 whitespace-nowrap active:scale-95 ${
                    exportSuccess === 'csv'
                      ? 'bg-teal-800 text-teal-100 border-teal-600'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title="Export marksheet to CSV (.csv) for Google Sheets & mobile devices"
                >
                  {exportLoading === 'csv' ? (
                    <RefreshCw size={13} className="animate-spin text-teal-400" />
                  ) : exportSuccess === 'csv' ? (
                    <Check size={13} className="text-teal-300" />
                  ) : (
                    <Download size={13} className="text-teal-400" />
                  )}
                  <span>{exportSuccess === 'csv' ? 'Exported!' : 'Export CSV'}</span>
                </button>

                {/* 3. Copy Data Button (1-Tap Universal Clipboard Copy for Excel & WhatsApp) */}
                <button
                  type="button"
                  onClick={handleCopyMarksTable}
                  disabled={!!exportLoading}
                  className={`px-3 py-2 md:py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 whitespace-nowrap active:scale-95 ${
                    exportSuccess === 'copy'
                      ? 'bg-amber-800 text-amber-100 border-amber-600'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title="Copy marksheet data to clipboard (tab-separated format for Excel & WhatsApp)"
                >
                  {exportLoading === 'copy' ? (
                    <RefreshCw size={13} className="animate-spin text-amber-400" />
                  ) : exportSuccess === 'copy' ? (
                    <Check size={13} className="text-amber-300" />
                  ) : (
                    <Copy size={13} className="text-amber-400" />
                  )}
                  <span>{exportSuccess === 'copy' ? 'Copied!' : 'Copy Data'}</span>
                </button>

                {/* 4. Print / PDF Button */}
                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="px-3 py-2 md:py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
                  title="Preview official printable marksheet and print or save as PDF"
                >
                  <Printer size={13} className="text-purple-400" />
                  <span>Print / PDF</span>
                </button>

                {/* 5. Export Options Modal Trigger */}
                <button
                  type="button"
                  onClick={() => {
                    const d = generateExportDataset();
                    if (d) {
                      setExportModalData(d);
                      setShowExportModal(true);
                    }
                  }}
                  className="px-3 py-2 md:py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
                  title="Open export and sharing options modal"
                >
                  <Share2 size={13} className="text-sky-400" />
                  <span>Options</span>
                </button>

                {/* 6. Import Button (Teacher Draft Mode) */}
                {!isReadOnly && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 md:py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
                      title="Import marks from spreadsheet file (.xlsx, .xls, .csv)"
                    >
                      <Upload size={13} className="text-blue-400" />
                      <span>Import</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImportExcel}
                      accept=".xlsx, .xls, .csv"
                      className="hidden"
                    />

                    {/* 4. Clear Marks Button */}
                    <button
                      type="button"
                      onClick={handleClearMarks}
                      className="px-3 py-2 md:py-1.5 rounded-xl text-xs font-semibold bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
                      title="Clear all entered student marks in this marksheet"
                    >
                      <Trash2 size={13} />
                      <span>Clear</span>
                    </button>
                  </>
                )}
              </div>

              {/* Right edge subtle fade gradient on mobile to visually indicate more swipeable actions */}
              <div 
                className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-900 via-slate-900/60 to-transparent md:hidden" 
                aria-hidden="true" 
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-800 text-slate-100 font-bold border-b border-slate-700">
              <tr>
                <th className="p-3 w-16 text-center text-slate-300 font-bold">Roll</th>
                <th className="p-3 text-slate-100 font-bold text-sm">Student Name</th>
                {components.map(comp => {
                  const isWeeklyTest = comp.component_code === 'TEST';
                  return (
                    <th key={comp.id} className={`p-3 text-center text-slate-100 font-bold transition-all ${isWeeklyTest && isWeeklyTestExpanded ? 'min-w-[280px]' : 'min-w-[140px]'}`}>
                      <div className="text-xs flex items-center justify-center gap-1.5">
                        {isWeeklyTest ? (
                          <button
                            type="button"
                            onClick={() => setIsWeeklyTestExpanded(!isWeeklyTestExpanded)}
                            className="flex items-center gap-1 hover:text-emerald-400 cursor-pointer font-bold transition text-xs"
                            title={isWeeklyTestExpanded ? 'Collapse test attempts' : 'Expand test attempts'}
                          >
                            <span className="text-[11px] text-emerald-400 font-black">
                              {isWeeklyTestExpanded ? '▼' : '▶'}
                            </span>
                            <span>{comp.component_name}</span>
                          </button>
                        ) : (
                          <span>{comp.component_name}</span>
                        )}
                        {isWeeklyTest && attempts.length > 1 && (
                          <span className="px-1.5 py-0.5 text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-700/60 rounded-full font-bold">
                            {attempts.length} Tests
                          </span>
                        )}
                        {comp.is_calculated && !isWeeklyTest && (
                          <span className="px-1.5 py-0.5 text-[9px] bg-cyan-900/80 text-cyan-300 border border-cyan-500/50 rounded-full font-bold uppercase tracking-wider">
                            Auto
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-300 font-medium mt-0.5">
                        {comp.is_calculated && !isWeeklyTest
                          ? `Auto Max /${comp.raw_max_marks}` 
                          : `Raw /${comp.raw_max_marks} (Weight: /${comp.converted_max_marks})`}
                      </div>
                      {isWeeklyTest && !isReadOnly && (
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={handleAddAttempt}
                            className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 transition cursor-pointer"
                            title="Add another weekly test attempt"
                          >
                            <Plus size={10} />
                            <span>Add Test</span>
                          </button>
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="p-3 text-center min-w-[110px] text-slate-100 font-bold">
                  <div className="text-xs">Calculated Total</div>
                  <div className="text-[11px] font-mono text-slate-300 font-medium mt-0.5">
                    /{components.filter(c => c.contributes_to_total !== false).reduce((acc, c) => acc + Number(c.converted_max_marks || c.raw_max_marks), 0)}
                  </div>
                </th>
                <th className="p-3 text-center w-24 text-slate-100 font-bold text-xs">
                  Grade
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredStudents.map(student => {
                // Collect scores and statuses for this student
                const studentScores = {};
                const studentStatuses = {};
                components.forEach(comp => {
                  if (comp.component_code === 'TEST' && attempts.length > 0) {
                    const agg = studentAttemptAggregates[student.id];
                    studentScores[comp.component_code] = agg?.aggregatedScore !== null && agg?.aggregatedScore !== undefined ? agg.aggregatedScore : '';
                    studentStatuses[comp.component_code] = agg?.status || 'MARKED';
                  } else {
                    const key = `${student.id}_${comp.component_code}`;
                    studentScores[comp.component_code] = rawScores[key];
                    studentStatuses[comp.component_code] = statuses[key] || 'MARKED';
                  }
                });

                // Automated ERP calculation
                const result = MarksCalculationEngine.calculateStudentResult({
                  components,
                  rawScores: studentScores,
                  statuses: studentStatuses,
                  gradeBoundaries: activePattern?.grade_boundaries || [],
                  roundingRule: activePattern?.rounding_rule || 'ROUND_2_DECIMALS'
                });

                return (
                  <tr 
                    key={student.id} 
                    className="border-b border-slate-800 bg-slate-900 hover:bg-slate-800/80 transition-colors"
                  >
                    <td className="p-3 text-center font-mono font-bold text-slate-300 text-sm">
                      {student.roll_no}
                    </td>
                    <td className="p-3 font-bold text-white text-sm">
                      {formatStudentDisplayName(student.name)}
                    </td>

                    {/* Component Inputs */}
                    {components.map(comp => {
                      const key = `${student.id}_${comp.component_code}`;
                      const compData = result.componentBreakdown?.find(b => b.componentCode === comp.component_code);
                      const isCalc = comp.is_calculated;

                      // SPECIAL HANDLING: Expandable Multiple-Test Attempts for Weekly Test
                      if (comp.component_code === 'TEST') {
                        const agg = studentAttemptAggregates[student.id];
                        const isExpanded = isWeeklyTestExpanded || expandedStudentIds[student.id];

                        // Case A: Single test and collapsed -> Render clean, familiar single-input cell
                        if (attempts.length <= 1 && !isExpanded) {
                          const defaultAtt = attempts[0] || { id: 'att_1', raw_max_marks: comp.raw_max_marks };
                          const attKey = `${student.id}_${defaultAtt.id}`;
                          const rawVal = attemptScores[attKey] !== undefined ? attemptScores[attKey] : (rawScores[key] || '');
                          const stStatus = attemptStatuses[attKey] || statuses[key] || 'MARKED';

                          return (
                            <td key={comp.id} className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {stStatus === 'MARKED' ? (
                                  <div className="relative">
                                    <input
                                      type="number"
                                      min="0"
                                      max={defaultAtt.raw_max_marks}
                                      step="0.5"
                                      disabled={isReadOnly}
                                      value={rawVal}
                                      onChange={e => {
                                        handleAttemptScoreChange(student.id, defaultAtt.id, e.target.value, defaultAtt.raw_max_marks);
                                        handleScoreChange(student.id, 'TEST', e.target.value, defaultAtt.raw_max_marks);
                                      }}
                                      placeholder={`0 - ${defaultAtt.raw_max_marks}`}
                                      className={`w-24 text-center py-1.5 px-2 font-mono font-bold text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all ${
                                        isReadOnly 
                                          ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed'
                                          : 'bg-slate-950 text-white border-slate-600 hover:border-slate-400 shadow-inner'
                                      }`}
                                    />
                                  </div>
                                ) : (
                                  <span className={`px-3 py-1 font-bold text-[11px] rounded-lg font-mono ${
                                    stStatus === 'ABSENT' 
                                      ? 'bg-rose-950 text-rose-300 border border-rose-500/60'
                                      : 'bg-slate-800 text-slate-300 border border-slate-600'
                                  }`}>
                                    {stStatus === 'ABSENT' ? 'AB' : 'NA'}
                                  </span>
                                )}

                                {!isReadOnly && (
                                  <div className="flex flex-col gap-1">
                                    <button
                                      type="button"
                                      title="Toggle Absent"
                                      onClick={() => {
                                        const nextSt = stStatus === 'ABSENT' ? 'MARKED' : 'ABSENT';
                                        handleAttemptStatusChange(student.id, defaultAtt.id, nextSt);
                                        handleStatusChange(student.id, 'TEST', nextSt);
                                      }}
                                      className={`px-1.5 py-0.5 text-[9px] font-black rounded border transition-colors cursor-pointer ${
                                        stStatus === 'ABSENT' 
                                          ? 'bg-rose-600 text-white border-rose-500' 
                                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                      }`}
                                    >
                                      AB
                                    </button>
                                    <button
                                      type="button"
                                      title="Toggle Not Applicable"
                                      onClick={() => {
                                        const nextSt = stStatus === 'NOT_APPLICABLE' ? 'MARKED' : 'NOT_APPLICABLE';
                                        handleAttemptStatusChange(student.id, defaultAtt.id, nextSt);
                                        handleStatusChange(student.id, 'TEST', nextSt);
                                      }}
                                      className={`px-1.5 py-0.5 text-[9px] font-black rounded border transition-colors cursor-pointer ${
                                        stStatus === 'NOT_APPLICABLE' 
                                          ? 'bg-amber-600 text-white border-amber-500' 
                                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                      }`}
                                    >
                                      NA
                                    </button>
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={() => toggleStudentExpanded(student.id)}
                                  title="Expand test attempts"
                                  className="p-1 text-slate-500 hover:text-emerald-400 transition cursor-pointer"
                                >
                                  <ChevronRight size={13} />
                                </button>
                              </div>
                            </td>
                          );
                        }

                        // Case B: Multi-test collapsed state
                        if (!isExpanded) {
                          return (
                            <td key={comp.id} className="p-3 text-center">
                              <div 
                                onClick={() => toggleStudentExpanded(student.id)}
                                className="cursor-pointer inline-flex flex-col items-center p-2 rounded-xl bg-slate-950/80 border border-slate-700/80 hover:border-emerald-500/60 transition shadow-sm"
                                title="Click to view and edit test attempts"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-emerald-400">▶</span>
                                  <span className="text-xs font-bold text-white font-mono">
                                    {agg?.displayText || '—'} /{comp.raw_max_marks}
                                  </span>
                                </div>
                                <span className="text-[10px] text-indigo-300 font-semibold mt-0.5">
                                  {attempts.length} Tests • Click to Expand
                                </span>
                              </div>
                            </td>
                          );
                        }

                        // Case C: Multi-test EXPANDED state (Section 10 & 11)
                        return (
                          <td key={comp.id} className="p-3 text-center">
                            <div className="bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 space-y-2 shadow-inner text-left min-w-[260px] max-w-sm mx-auto">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleStudentExpanded(student.id)}
                                    className="text-slate-400 hover:text-white transition"
                                    title="Collapse attempts"
                                  >
                                    <ChevronDown size={14} className="text-emerald-400" />
                                  </button>
                                  <span className="text-xs font-bold text-slate-200">Weekly Test</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 font-mono font-bold">
                                    {attempts.length} Tests
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-mono font-bold text-emerald-400">
                                    Avg: {agg?.displayText || '—'} /{comp.raw_max_marks}
                                  </span>
                                </div>
                              </div>

                              {/* Attempts Matrix */}
                              <div className="space-y-1.5">
                                {attempts.map(att => {
                                  const attKey = `${student.id}_${att.id}`;
                                  const attVal = attemptScores[attKey] !== undefined ? attemptScores[attKey] : '';
                                  const attSt = attemptStatuses[attKey] || 'MARKED';

                                  return (
                                    <div key={att.id} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                                      <div className="flex items-center gap-1 min-w-[65px]">
                                        <span className="text-xs font-bold text-white">{att.attempt_name}</span>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        {attSt === 'MARKED' ? (
                                          <input
                                            type="number"
                                            min="0"
                                            max={att.raw_max_marks}
                                            step="0.5"
                                            disabled={isReadOnly}
                                            value={attVal}
                                            onChange={e => handleAttemptScoreChange(student.id, att.id, e.target.value, att.raw_max_marks)}
                                            placeholder={`0 - ${att.raw_max_marks}`}
                                            className={`w-20 text-center py-1 px-1.5 font-mono font-bold text-xs rounded border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                                              isReadOnly 
                                                ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed'
                                                : 'bg-slate-950 text-white border-slate-600 hover:border-slate-400'
                                            }`}
                                          />
                                        ) : (
                                          <span className={`px-2 py-0.5 font-bold text-[10px] rounded font-mono ${
                                            attSt === 'ABSENT' 
                                              ? 'bg-rose-950 text-rose-300 border border-rose-500/60' 
                                              : 'bg-slate-800 text-slate-300 border border-slate-600'
                                          }`}>
                                            {attSt === 'ABSENT' ? 'AB' : 'NA'}
                                          </span>
                                        )}

                                        {!isReadOnly && (
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              title="Toggle Absent"
                                              onClick={() => handleAttemptStatusChange(student.id, att.id, attSt === 'ABSENT' ? 'MARKED' : 'ABSENT')}
                                              className={`px-1.5 py-0.5 text-[9px] font-black rounded border cursor-pointer ${
                                                attSt === 'ABSENT' ? 'bg-rose-600 text-white border-rose-500' : 'bg-slate-800 text-slate-400 border-slate-700'
                                              }`}
                                            >
                                              AB
                                            </button>
                                            <button
                                              type="button"
                                              title="Toggle Not Applicable"
                                              onClick={() => handleAttemptStatusChange(student.id, att.id, attSt === 'NOT_APPLICABLE' ? 'MARKED' : 'NOT_APPLICABLE')}
                                              className={`px-1.5 py-0.5 text-[9px] font-black rounded border cursor-pointer ${
                                                attSt === 'NOT_APPLICABLE' ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-800 text-slate-400 border-slate-700'
                                              }`}
                                            >
                                              NA
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Footer with summary and add attempt */}
                              <div className="pt-1 flex items-center justify-between text-[11px] border-t border-slate-800 text-slate-400">
                                <div className="font-semibold text-slate-300">
                                  Average: <span className="text-emerald-400 font-mono font-bold">{agg?.displayText || '—'} /{comp.raw_max_marks}</span>
                                </div>
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={handleAddAttempt}
                                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                                  >
                                    + Add Test
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      }

                      const rawVal = isCalc ? compData?.rawScore : (rawScores[key] !== undefined ? rawScores[key] : '');
                      const stStatus = isCalc ? compData?.status : (statuses[key] || 'MARKED');
                      const converted = compData?.convertedScore !== null && compData?.convertedScore !== undefined
                        ? compData.convertedScore
                        : MarksCalculationEngine.convertComponentScore(rawVal, comp);

                      if (isCalc) {
                        return (
                          <td key={comp.id} className="p-3 text-center">
                            <div className="flex flex-col items-center justify-center">
                              {stStatus === 'ABSENT' ? (
                                <span className="px-3 py-1 font-bold text-[11px] rounded-lg font-mono bg-rose-950 text-rose-300 border border-rose-500/60 shadow-sm">
                                  AB
                                </span>
                              ) : rawVal !== '' && rawVal !== null && rawVal !== undefined ? (
                                <div className="flex flex-col items-center">
                                  <span className="w-24 py-1.5 px-2 font-mono font-bold text-xs rounded-lg bg-cyan-950/70 text-cyan-300 border border-cyan-500/60 text-center shadow-inner tracking-tight">
                                    {Number(rawVal).toFixed(2)}
                                  </span>
                                  <span className="text-[10px] font-semibold text-cyan-400/90 mt-0.5">
                                    Auto Average
                                  </span>
                                </div>
                              ) : (
                                <span className="font-mono text-slate-500 font-semibold text-xs">
                                  —
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={comp.id} className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {stStatus === 'MARKED' ? (
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  max={comp.raw_max_marks}
                                  step="0.5"
                                  disabled={isReadOnly}
                                  value={rawVal}
                                  onChange={e => handleScoreChange(student.id, comp.component_code, e.target.value, comp.raw_max_marks)}
                                  placeholder={`0 - ${comp.raw_max_marks}`}
                                  className={`w-24 text-center py-1.5 px-2 font-mono font-bold text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all ${
                                    isReadOnly 
                                      ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed'
                                      : 'bg-slate-950 text-white border-slate-600 hover:border-slate-400 shadow-inner'
                                  }`}
                                />
                                {comp.raw_max_marks !== comp.converted_max_marks && rawVal !== '' && (
                                  <span className="block text-[11px] font-mono text-emerald-400 font-semibold mt-0.5">
                                    ={converted}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className={`px-3 py-1 font-bold text-[11px] rounded-lg font-mono ${
                                stStatus === 'ABSENT' 
                                  ? 'bg-rose-950 text-rose-300 border border-rose-500/60'
                                  : 'bg-slate-800 text-slate-300 border border-slate-600'
                              }`}>
                                {stStatus}
                              </span>
                            )}

                            {/* Status Toggle buttons (Absent / N/A) */}
                            {!isReadOnly && (
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  title="Toggle Absent"
                                  onClick={() => handleStatusChange(student.id, comp.component_code, stStatus === 'ABSENT' ? 'MARKED' : 'ABSENT')}
                                  className={`px-1.5 py-0.5 text-[9px] font-black rounded border transition-colors cursor-pointer ${
                                    stStatus === 'ABSENT' 
                                      ? 'bg-rose-600 text-white border-rose-500' 
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                  }`}
                                >
                                  AB
                                </button>
                                <button
                                  type="button"
                                  title="Toggle Not Applicable"
                                  onClick={() => handleStatusChange(student.id, comp.component_code, stStatus === 'NOT_APPLICABLE' ? 'MARKED' : 'NOT_APPLICABLE')}
                                  className={`px-1.5 py-0.5 text-[9px] font-black rounded border transition-colors cursor-pointer ${
                                    stStatus === 'NOT_APPLICABLE' 
                                      ? 'bg-amber-600 text-white border-amber-500' 
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                  }`}
                                >
                                  NA
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Calculated Total */}
                    <td className="p-3 text-center bg-slate-900">
                      <span className="font-mono font-bold text-sm text-white">
                        {result.hasAnyMark ? (result.isAllAbsent ? 'AB' : result.totalConverted) : '—'}
                      </span>
                      {result.percentage !== null && !result.isAllAbsent && (
                        <span className="block text-[11px] text-slate-300 font-mono font-semibold">
                          {result.percentage}%
                        </span>
                      )}
                    </td>

                    {/* Grade */}
                    <td className="p-3 text-center bg-slate-900">
                      {result.grade ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          {result.grade}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-semibold">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={components.length + 4} className="p-8 text-center text-slate-400">
                    No active students found for this class and elective/subject criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-emerald-400" />
            <span>Calculated automatically by Gyanoday ERP based on configured assessment scheme.</span>
          </div>
          <div className="font-mono text-[11px] text-slate-400 font-semibold">
            {filteredStudents.length} Students Listed
          </div>
        </div>
      </div>

      {/* Tuesday Assembly Honours & Attention Summary Card */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden mb-8 no-print">
        {/* Header with Title & Quick Share Actions */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Trophy size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-white tracking-tight">
                  Tuesday Assembly Honours & Attention Summary
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Live Preview
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                  Subject: {subjectDisplayName}
                </span>
                {siblingClasses.length > 1 && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {combinedSectionsLabel} Available
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically calculated for Principal's Tuesday morning assembly announcements & monitoring.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleWhatsAppToPrincipal}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 transition-all shadow-md shadow-emerald-950/30 active:scale-95 cursor-pointer"
              title="Open WhatsApp with pre-formatted assembly honours text"
            >
              <MessageCircle size={15} />
              <span>WhatsApp to Principal</span>
            </button>

            <button
              type="button"
              onClick={handleCopyAssembly}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer active:scale-95 ${
                copiedAssembly 
                  ? 'bg-emerald-900/60 text-emerald-300 border-emerald-500/50' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Copy formatted markdown text to clipboard"
            >
              {copiedAssembly ? <CheckCheck size={15} className="text-emerald-400" /> : <Copy size={15} />}
              <span>{copiedAssembly ? 'Copied to Clipboard!' : 'Copy Briefing'}</span>
            </button>

            {/* Print Slip for Current Section */}
            <button
              type="button"
              onClick={handlePrintAssemblySlip}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title={`Print podium slip for ${cls?.name} ${cls?.section || ''}`}
            >
              <Printer size={15} />
              <span>Print Slip ({cls?.section || cls?.name})</span>
            </button>

            {/* Print Slip for BOTH Sections on ONE Page */}
            {siblingClasses.length > 1 && (
              <button
                type="button"
                onClick={handlePrintBothSections}
                className="px-3.5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-all shadow-md shadow-indigo-950/40 border border-indigo-400/40 active:scale-95 cursor-pointer"
                title={`Print combined 1-page slip for both ${combinedSectionsLabel} in one go to save paper`}
              >
                <Printer size={15} />
                <span>Print Both ({combinedSectionsLabel}) — 1 Page</span>
              </button>
            )}
          </div>
        </div>

        {/* Section View Tabs for Live Preview (When multiple sections exist) */}
        {siblingClasses.length > 1 && (
          <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400">Preview Mode:</span>
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('both')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activePreviewTab === 'both'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Sparkles size={12} />
                  <span>Both ({combinedSectionsLabel}) [Combined]</span>
                </button>
                {siblingClasses.map(sCls => (
                  <button
                    key={sCls.id}
                    type="button"
                    onClick={() => setActivePreviewTab(sCls.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                      activePreviewTab === sCls.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    Class {sCls.name} {sCls.section} {sCls.id === classId ? '(Current)' : ''}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <span>💡 Paper Saving: Use <strong>"Print Both"</strong> to fit both {combinedSectionsLabel} on 1 sheet for Principal.</span>
            </div>
          </div>
        )}

        {/* Preview Content: Combined Both Sections OR Single Selected Section */}
        {activePreviewTab === 'both' && siblingClasses.length > 1 ? (
          <div className="p-5 space-y-6 bg-slate-950/40">
            {allSectionSummaries.map(({ cls: secCls, summary: secSummary }) => (
              <div key={secCls.id} className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Class: {secCls.name} {secCls.section}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Subject: {subjectDisplayName}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {secCls.id === classId ? '(Current Roster)' : '(Sibling Section)'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {secSummary.topScorers.length} Honours • {secSummary.requiresAttention.length} Requires Attention{secSummary.absentees?.length > 0 ? ` • ${secSummary.absentees.length} Absent` : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Top Scorers Column */}
                  <div className="rounded-xl border border-emerald-500/30 bg-slate-900/90 overflow-hidden shadow-sm">
                    <div className="px-4 py-2.5 bg-emerald-950/40 border-b border-emerald-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wide">
                        <Trophy size={15} className="text-emerald-400" />
                        <span>Top Scorers (Assembly Honours)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-emerald-300/80 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        {secSummary.topScorers.length} Student{secSummary.topScorers.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="p-0 divide-y divide-slate-800 max-h-64 overflow-y-auto">
                      {secSummary.topScorers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 font-medium">
                          No marks entered yet for this section.
                        </div>
                      ) : (
                        secSummary.topScorers.map(s => (
                          <div key={s.student.id} className="p-2.5 px-3 flex items-center justify-between gap-2 hover:bg-slate-850/60 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] text-white shrink-0 ${
                                s.rank === 1 ? 'bg-yellow-500' : s.rank === 2 ? 'bg-slate-400' : 'bg-amber-600'
                              }`}>
                                {s.rank}
                              </div>
                              <span className="font-bold text-xs text-white truncate max-w-[150px]">
                                {formatStudentDisplayName(s.student.name)}
                              </span>
                              {s.house && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${getHouseBadgeColor(s.house)}`}>
                                  {s.house}
                                </span>
                              )}
                            </div>
                            <div className="font-mono font-black text-sm text-emerald-400 shrink-0">
                              {s.total}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Requires Attention Column */}
                  <div className="rounded-xl border border-rose-500/30 bg-slate-900/90 overflow-hidden shadow-sm">
                    <div className="px-4 py-2.5 bg-rose-950/40 border-b border-rose-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wide">
                        <AlertCircle size={15} className="text-rose-400" />
                        <span>Requires Attention (Below 10)</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-rose-300/80 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-500/30">
                        {secSummary.requiresAttention.length} Student{secSummary.requiresAttention.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="p-0 divide-y divide-slate-800 max-h-64 overflow-y-auto">
                      {secSummary.requiresAttention.length === 0 ? (
                        <div className="p-4 text-center text-xs text-emerald-400/90 font-medium">
                          ✓ All evaluated students scored ≥ 10.
                        </div>
                      ) : (
                        secSummary.requiresAttention.map(s => (
                          <div key={s.student.id} className="p-2.5 px-3 flex items-center justify-between gap-2 hover:bg-slate-850/60 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <Frown size={15} className="text-slate-400 shrink-0" />
                              <span className="font-bold text-xs text-slate-200 truncate max-w-[150px]">
                                {formatStudentDisplayName(s.student.name)}
                              </span>
                              {s.house && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${getHouseBadgeColor(s.house)}`}>
                                  {s.house}
                                </span>
                              )}
                            </div>
                            <div className="font-mono font-black text-sm text-rose-400 shrink-0">
                              {s.total}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Dedicated Absentee Section */}
                {secSummary.absentees && secSummary.absentees.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700/70 flex items-center justify-between gap-3 text-xs flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase bg-slate-800 text-amber-300 border border-amber-500/30">
                        📋 Absent Students ({secSummary.absentees.length})
                      </span>
                      <span className="text-slate-300 font-medium">
                        {secSummary.absentees.map(a => `${formatStudentDisplayName(a.student.name)}${a.house ? ` (${a.house})` : ''}`).join(', ')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Single section preview (current or selected) */
          (() => {
            const activeSummary = (activePreviewTab !== 'both' && activePreviewTab !== classId)
              ? (allSectionSummaries.find(s => s.cls.id === activePreviewTab)?.summary || assemblySummary)
              : assemblySummary;
            const activeCls = (activePreviewTab !== 'both' && activePreviewTab !== classId)
              ? (siblingClasses.find(c => c.id === activePreviewTab) || cls)
              : cls;

            return (
              <div className="p-5 space-y-4 bg-slate-950/40">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Class: {activeCls?.name} {activeCls?.section}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Subject: {subjectDisplayName}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {activeCls?.id === classId ? '(Current Roster)' : '(Sibling Section)'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {activeSummary.topScorers.length} Honours • {activeSummary.requiresAttention.length} Requires Attention{activeSummary.absentees?.length > 0 ? ` • ${activeSummary.absentees.length} Absent` : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Scorers (1st, 2nd, 3rd) */}
                <div className="rounded-xl border border-emerald-500/30 bg-slate-900/90 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-emerald-950/40 border-b border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <Trophy size={17} className="text-emerald-400" />
                      <span>Top Scorers (Assembly Honours)</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-emerald-300/80 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      {activeSummary.topScorers.length} Student{activeSummary.topScorers.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="p-0 divide-y divide-slate-800">
                    {activeSummary.topScorers.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 font-medium">
                        No marks entered yet. Marks entered in the roster above will automatically populate top 1st, 2nd, and 3rd rankers here.
                      </div>
                    ) : (
                      activeSummary.topScorers.map(s => (
                        <div key={s.student.id} className="p-3.5 px-4 flex items-center justify-between gap-3 hover:bg-slate-850/60 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs text-white shadow-sm shrink-0 ${
                              s.rank === 1 ? 'bg-yellow-500 ring-2 ring-yellow-400/30' :
                              s.rank === 2 ? 'bg-slate-400 ring-2 ring-slate-300/30' :
                              'bg-amber-600 ring-2 ring-amber-500/30'
                            }`}>
                              {s.rank}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="font-bold text-sm text-white truncate">
                                {formatStudentDisplayName(s.student.name)}
                              </span>
                              {s.house && (
                                <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${getHouseBadgeColor(s.house)}`}>
                                  {s.house}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {s.grade && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                {s.grade}
                              </span>
                            )}
                            <div className="font-mono font-black text-lg text-emerald-400">
                              {s.total}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Requires Attention (Below 10) */}
                <div className="rounded-xl border border-rose-500/30 bg-slate-900/90 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-rose-950/40 border-b border-rose-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                      <AlertCircle size={17} className="text-rose-400" />
                      <span>Requires Attention (Below 10)</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-rose-300/80 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-500/30">
                      {activeSummary.requiresAttention.length} Student{activeSummary.requiresAttention.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="p-0 divide-y divide-slate-800">
                    {activeSummary.requiresAttention.length === 0 ? (
                      <div className="p-6 text-center text-xs text-emerald-400/90 font-medium">
                        ✓ All evaluated students scored ≥ 10.
                      </div>
                    ) : (
                      activeSummary.requiresAttention.map(s => (
                        <div key={s.student.id} className="p-3.5 px-4 flex items-center justify-between gap-3 hover:bg-slate-850/60 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <Frown size={18} className="text-slate-400 shrink-0" />
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="font-bold text-sm text-slate-200 truncate">
                                {formatStudentDisplayName(s.student.name)}
                              </span>
                              {s.house && (
                                <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${getHouseBadgeColor(s.house)}`}>
                                  {s.house}
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="font-mono font-black text-base text-rose-400">
                              {s.total}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Dedicated Absentee Section */}
              {activeSummary.absentees && activeSummary.absentees.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/70 flex items-center justify-between gap-3 text-xs flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase bg-slate-800 text-amber-300 border border-amber-500/30">
                      📋 Absent Students ({activeSummary.absentees.length})
                    </span>
                    <span className="text-slate-300 font-medium">
                      {activeSummary.absentees.map(a => `${formatStudentDisplayName(a.student.name)}${a.house ? ` (${a.house})` : ''}`).join(', ')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })()
        )}
      </div>
      </div> {/* End screen interactive UI (no-print) */}

      {/* Print-Only Tuesday Assembly Podium Slip (Guaranteed 1 Single Page) */}
      <div 
        id="print-assembly-slip" 
        className="hidden print:block font-sans text-black bg-white" 
        style={{ background: '#ffffff', backgroundColor: '#ffffff', color: '#000000' }}
      >
        <style>{`
          @page {
            margin: 6mm 8mm 6mm 8mm !important;
            size: portrait;
          }
          @media print {
            :root, :root.dark {
              --bg-color: #ffffff !important;
            }
            *, *::before, *::after {
              color-scheme: light !important;
              box-shadow: none !important;
              text-shadow: none !important;
            }
            html, html.dark, body, body.dark, #root, .app, .app-layout, .main-content, .layout-content-container, .max-w-7xl, #print-assembly-slip, .print-page-boundary {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              border: none !important;
              box-shadow: none !important;
              width: 100% !important;
              max-width: 100% !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
            }
            .print-page-boundary {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              width: 100% !important;
              min-height: 280mm !important;
              box-sizing: border-box !important;
              background: #ffffff !important;
              background-color: #ffffff !important;
              color: #000000 !important;
            }
          }
        `}</style>

        {printSlipMode === 'both' && siblingClasses.length > 1 ? (
          /* COMBINED 1-PAGE REPORT FOR BOTH SECTIONS (e.g. 7A & 7B) */
          <div 
            className="print-page-boundary p-1 bg-white" 
            style={{ background: '#ffffff', backgroundColor: '#ffffff', color: '#000000' }}
          >
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-1.5 mb-2">
              <h1 className="text-lg font-black uppercase tracking-wider font-serif text-black">GYANODAY NIKETAN</h1>
              <h2 className="text-xs font-black uppercase tracking-wide text-black mt-0.5">
                Tuesday Morning Assembly Honours & Attention Slip
              </h2>
              <div className="flex justify-center items-center gap-3 text-[10.5px] font-bold mt-1 text-black flex-wrap">
                <span><strong>Classes:</strong> {combinedSectionsLabel}</span>
                <span>•</span>
                <span className="bg-white px-1.5 py-0.5 rounded border border-black text-black"><strong>Subject:</strong> {subjectDisplayName}</span>
                <span>•</span>
                <span><strong>Term:</strong> {selectedTerm === 'Midterm' ? 'Mid-Term Exam' : 'Final-Term Exam'} {academicYear}</span>
                <span>•</span>
                <span><strong>Teacher:</strong> {profile?.name || 'Faculty Member'}</span>
              </div>
            </div>

            {/* Sections List */}
            <div className="space-y-2">
              {allSectionSummaries.map(({ cls: secCls, summary: secSummary }) => (
                <div key={secCls.id} className="border border-black rounded p-1.5 bg-white" style={{ background: '#ffffff', backgroundColor: '#ffffff', color: '#000000' }}>
                  {/* Section Sub-header */}
                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-black">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-[11px] uppercase tracking-wider text-black bg-white px-2 py-0.5 rounded border border-black">
                        Class: {secCls.name} {secCls.section}
                      </span>
                      <span className="font-bold text-[10.5px] uppercase tracking-wide text-black bg-white px-2 py-0.5 rounded border border-black">
                        Subject: {subjectDisplayName}
                      </span>
                    </div>
                    <span className="text-[9.5px] font-bold text-black">
                      {secSummary.topScorers.length} Honours Rankers • {secSummary.requiresAttention.length} Below 10{secSummary.absentees?.length > 0 ? ` • ${secSummary.absentees.length} Absent` : ''}
                    </span>
                  </div>

                  {/* 2-Column Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Left Column: Top Scorers */}
                    <div className="border border-black rounded p-1.5 bg-white" style={{ background: '#ffffff', backgroundColor: '#ffffff', color: '#000000' }}>
                      <h3 className="font-black text-[10px] uppercase tracking-wider pb-0.5 border-b border-black text-black mb-1 flex items-center justify-between">
                        <span>🏆 Top Scorers (Assembly Honours)</span>
                      </h3>
                      {secSummary.topScorers.length === 0 ? (
                        <p className="text-[9.5px] italic text-slate-600 py-0.5">No marks entered yet</p>
                      ) : (
                        <table className="w-full text-[9.5px] leading-tight">
                          <thead>
                            <tr className="border-b border-black text-black font-bold text-left">
                              <th className="pb-0.5 w-9">Rank</th>
                              <th className="pb-0.5">Student Name</th>
                              <th className="pb-0.5 w-16">House</th>
                              <th className="pb-0.5 text-right w-10">Marks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {secSummary.topScorers.map((s, idx) => (
                              <tr key={idx} className="bg-white">
                                <td className="py-0.5 font-bold text-black">{s.rank === 1 ? '1st' : s.rank === 2 ? '2nd' : '3rd'}</td>
                                <td className="py-0.5 font-semibold text-black truncate max-w-[130px]">{formatStudentDisplayName(s.student.name)}</td>
                                <td className="py-0.5 text-black">{s.house || '—'}</td>
                                <td className="py-0.5 text-right font-black text-black">{s.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Right Column: Requires Attention */}
                    <div className="border border-black rounded p-1.5 bg-white" style={{ background: '#ffffff', backgroundColor: '#ffffff', color: '#000000' }}>
                      <h3 className="font-black text-[10px] uppercase tracking-wider pb-0.5 border-b border-black text-black mb-1 flex items-center justify-between">
                        <span>⚠️ Requires Attention (Below 10)</span>
                      </h3>
                      {secSummary.requiresAttention.length === 0 ? (
                        <p className="text-[9.5px] italic text-emerald-800 font-medium py-0.5">All evaluated students scored ≥ 10</p>
                      ) : (
                        <table className="w-full text-[9.5px] leading-tight">
                          <thead>
                            <tr className="border-b border-black text-black font-bold text-left">
                              <th className="pb-0.5">Student Name</th>
                              <th className="pb-0.5 w-16">House</th>
                              <th className="pb-0.5 text-right w-12">Marks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {secSummary.requiresAttention.map((s, idx) => (
                              <tr key={idx} className="bg-white">
                                <td className="py-0.5 font-semibold text-black truncate max-w-[130px]">{formatStudentDisplayName(s.student.name)}</td>
                                <td className="py-0.5 text-black">{s.house || '—'}</td>
                                <td className="py-0.5 text-right font-bold text-rose-800">{s.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Dedicated Absentee Section */}
                  {secSummary.absentees && secSummary.absentees.length > 0 && (
                    <div className="mt-1.5 pt-1 border-t border-black text-[9.5px] text-black">
                      <span className="font-bold">📋 Absent Students ({secSummary.absentees.length}): </span>
                      <span className="font-semibold text-slate-800">
                        {secSummary.absentees.map(a => `${formatStudentDisplayName(a.student.name)}${a.house ? ` (${a.house})` : ''}`).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Signatures */}
            <div className="mt-2 pt-2 border-t border-black flex justify-between text-[10px] text-black font-semibold">
              <div>
                <span>Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div>
                <span>Teacher Signature: _______________________</span>
              </div>
              <div>
                <span>Principal Initials: __________</span>
              </div>
            </div>
          </div>
        ) : (
          /* SINGLE SECTION 1-PAGE PODIUM SLIP */
          <div 
            className="print-page-boundary p-2 bg-white" 
            style={{ background: '#ffffff', backgroundColor: '#ffffff', color: '#000000' }}
          >
            <div className="text-center border-b-2 border-black pb-3 mb-4">
              <h1 className="text-xl font-black uppercase tracking-wider font-serif text-black">GYANODAY NIKETAN</h1>
              <h2 className="text-sm font-bold uppercase tracking-wide text-black mt-0.5">
                Tuesday Morning Assembly Honours & Attention Slip
              </h2>
              <div className="flex justify-center items-center gap-4 text-xs font-bold mt-2 text-black flex-wrap">
                <span><strong>Class:</strong> {cls?.name} {cls?.section}</span>
                <span>•</span>
                <span className="bg-white px-1.5 py-0.5 rounded border border-black text-black"><strong>Subject:</strong> {subjectDisplayName}</span>
                <span>•</span>
                <span><strong>Term:</strong> {selectedTerm === 'Midterm' ? 'Mid-Term Exam' : 'Final-Term Exam'} {academicYear}</span>
                <span>•</span>
                <span><strong>Teacher:</strong> {profile?.name || 'Faculty Member'}</span>
                <span>•</span>
                <span className="font-mono text-black">
                  {assemblySummary.topScorers.length} Honours Rankers • {assemblySummary.requiresAttention.length} Below 10{assemblySummary.absentees?.length > 0 ? ` • ${assemblySummary.absentees.length} Absent` : ''}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Top Scorers Column */}
              <div className="border border-black rounded p-2.5 bg-white" style={{ background: '#ffffff', backgroundColor: '#ffffff', color: '#000000' }}>
                <h3 className="font-black text-xs uppercase tracking-wider pb-1.5 border-b border-black text-black mb-2">
                  🏆 Top Scorers (Assembly Honours)
                </h3>
                {assemblySummary.topScorers.length === 0 ? (
                  <p className="text-xs italic text-slate-600">No marks entered yet</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-black text-black font-bold text-left">
                        <th className="pb-1 w-12">Rank</th>
                        <th className="pb-1">Student Name</th>
                        <th className="pb-1 w-20">House</th>
                        <th className="pb-1 text-right w-12">Marks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {assemblySummary.topScorers.map((s, i) => (
                        <tr key={i} className="py-1 bg-white">
                          <td className="py-1 font-bold text-black">
                            {s.rank === 1 ? '1st' : s.rank === 2 ? '2nd' : '3rd'}
                          </td>
                          <td className="py-1 font-semibold text-black">{formatStudentDisplayName(s.student.name)}</td>
                          <td className="py-1 text-black">{s.house || '—'}</td>
                          <td className="py-1 text-right font-black text-black">{s.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Requires Attention Column */}
              <div className="border border-black rounded p-2.5 bg-white" style={{ background: '#ffffff', backgroundColor: '#ffffff', color: '#000000' }}>
                <h3 className="font-black text-xs uppercase tracking-wider pb-1.5 border-b border-black text-black mb-2">
                  ⚠️ Requires Attention (Below 10)
                </h3>
                {assemblySummary.requiresAttention.length === 0 ? (
                  <p className="text-xs italic text-emerald-700 font-medium">All evaluated students scored ≥ 10</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-black text-black font-bold text-left">
                        <th className="pb-1">Student Name</th>
                        <th className="pb-1 w-20">House</th>
                        <th className="pb-1 text-right w-16">Marks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {assemblySummary.requiresAttention.map((s, i) => (
                        <tr key={i} className="py-1 bg-white">
                          <td className="py-1 font-semibold text-black">{formatStudentDisplayName(s.student.name)}</td>
                          <td className="py-1 text-black">{s.house || '—'}</td>
                          <td className="py-1 text-right font-bold text-rose-800">
                            {s.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Dedicated Absentee Section */}
            {assemblySummary.absentees && assemblySummary.absentees.length > 0 && (
              <div className="mt-3 pt-2 border-t border-black text-xs text-black">
                <span className="font-bold">📋 Absent Students ({assemblySummary.absentees.length}): </span>
                <span className="font-semibold text-slate-800">
                  {assemblySummary.absentees.map(a => `${formatStudentDisplayName(a.student.name)}${a.house ? ` (${a.house})` : ''}`).join(', ')}
                </span>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-black flex justify-between text-xs text-black font-semibold">
              <div>
                <span>Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div>
                <span>Teacher Signature: _______________________</span>
              </div>
              <div>
                <span>Principal Initials: __________</span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* COMPREHENSIVE EXPORT & SHARE MODAL (MOBILE & DESKTOP)    */}
        {/* ======================================================== */}
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 text-slate-100 rounded-2xl max-w-lg w-full p-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <FileText size={18} />
                    </span>
                    <h3 className="text-base font-bold text-white">Export & Share Marksheet</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Class {cls?.name} {cls?.section} • {subjectDisplayName} • {selectedTerm} {academicYear}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-300 rounded font-mono font-semibold">
                      {filteredStudents.length} Students Listed
                    </span>
                    {attempts.length > 1 && (
                      <span className="px-2 py-0.5 text-[10px] bg-indigo-900/60 text-indigo-300 rounded font-semibold">
                        {attempts.length} Test Attempts
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  title="Close dialog"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Options List */}
              {/* Options List */}
              <div className="mt-4 space-y-3">
                {/* Option 1: Direct File Download (.xlsx / .csv) */}
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
                    <Download size={13} />
                    <span>1. Direct File Download (.xlsx / .csv)</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2.5">
                    Downloads spreadsheet directly to your phone or computer. Compatible with Android, iOS, Windows & Mac.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleTriggerDirectDownload('excel')}
                      disabled={!!exportLoading}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 transition active:scale-95 shadow cursor-pointer"
                    >
                      <FileText size={14} />
                      <span>Download Excel (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTriggerDirectDownload('csv')}
                      disabled={!!exportLoading}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white flex items-center justify-center gap-1.5 transition active:scale-95 shadow cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Download CSV (.csv)</span>
                    </button>
                  </div>
                  {exportModalData?.cloudUrl && (
                    <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-[280px]">
                        Cloud Download Ready
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (navigator.clipboard?.writeText) {
                            await navigator.clipboard.writeText(exportModalData.cloudUrl);
                            setCopySuccess('cloud_url');
                            setTimeout(() => setCopySuccess(null), 2500);
                          }
                        }}
                        className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                      >
                        {copySuccess === 'cloud_url' ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copySuccess === 'cloud_url' ? 'Link Copied!' : 'Copy Direct Link'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Option 2: 1-Tap Copy to Clipboard */}
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1.5">
                    <Copy size={13} />
                    <span>2. Instant Copy to Clipboard (Universal 100%)</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2.5">
                    Copies complete student roster, attempts, marks & grades. Paste directly into Microsoft Excel, Google Sheets, or WhatsApp.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleCopyMarksTable();
                    }}
                    disabled={!!exportLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center gap-1.5 transition active:scale-95 shadow cursor-pointer"
                  >
                    <Copy size={14} />
                    <span>Copy Marksheet Data (Table / TSV)</span>
                  </button>
                </div>

                {/* Option 3: Mobile Share Sheet (WhatsApp, Drive, Quick Share) */}
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider mb-1.5">
                    <Share2 size={13} />
                    <span>3. Share to Phone Apps (WhatsApp, Drive, Mail)</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2.5">
                    Send directly to WhatsApp contacts, save to Google Drive, or share via Gmail.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const dataset = exportModalData || generateExportDataset();
                      if (!dataset) return;
                      const fileName = `${dataset.baseName}.xlsx`;
                      const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

                      // A. GyanodayNative shareFile
                      if (typeof window !== 'undefined' && window.GyanodayNative?.shareFile && dataset.b64) {
                        try {
                          if (window.GyanodayNative.shareFile(dataset.b64, mime, fileName)) return;
                        } catch (e) {}
                      }

                      // B. Web Share API Level 2 (files)
                      if (typeof navigator !== 'undefined' && navigator.share && dataset.xlsxBlob && typeof File !== 'undefined') {
                        try {
                          const file = new File([dataset.xlsxBlob], fileName, { type: mime });
                          if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            await navigator.share({
                              files: [file],
                              title: fileName,
                              text: `Gyanoday Niketan Marksheet: ${fileName}`
                            });
                            return;
                          }
                        } catch (e) {
                          if (e.name === 'AbortError') return;
                        }
                      }

                      // C. Fallback: Share download link or WhatsApp link
                      const shareText = dataset.cloudUrl 
                        ? `Gyanoday Niketan Marksheet (${fileName}):\nDownload Link: ${dataset.cloudUrl}`
                        : `Gyanoday Niketan Marksheet: ${fileName}`;
                      if (typeof navigator !== 'undefined' && navigator.share) {
                        try {
                          await navigator.share({ title: fileName, text: shareText, url: dataset.cloudUrl || undefined });
                          return;
                        } catch (e) {
                          if (e.name === 'AbortError') return;
                        }
                      }

                      // D. WhatsApp Direct fallback
                      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
                      window.open(waUrl, '_blank');
                    }}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center gap-1.5 transition active:scale-95 shadow cursor-pointer"
                  >
                    <Share2 size={14} />
                    <span>Share Marksheet (WhatsApp / Apps)</span>
                  </button>
                </div>

                {/* Option 4: View & Print / Save PDF */}
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider mb-1.5">
                    <Printer size={13} />
                    <span>4. Official Printable Marksheet (PDF)</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2.5">
                    Opens a full-page clean print preview with browser "Save as PDF" capability.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportModal(false);
                      setShowPrintModal(true);
                    }}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-1.5 transition active:scale-95 shadow cursor-pointer"
                  >
                    <Printer size={14} />
                    <span>Preview & Print / Save PDF</span>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="py-1.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PRINTABLE OFFICIAL MARKSHEET MODAL                       */}
        {/* ======================================================== */}
        {showPrintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white text-black rounded-xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl relative max-h-[95vh] overflow-y-auto">
              {/* Action Bar (Hidden during window.print) */}
              <div className="no-print flex items-center justify-between pb-3 mb-4 border-b border-slate-300">
                <div className="flex items-center gap-2">
                  <Printer size={18} className="text-purple-700" />
                  <span className="font-bold text-sm text-slate-800">Printable Marksheet Preview</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                  >
                    <Printer size={13} />
                    <span>Print / Save as PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPrintModal(false)}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Printable Content */}
              <div className="print-content text-black bg-white">
                <div className="text-center border-b-2 border-black pb-3 mb-3">
                  <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider font-serif text-black">GYANODAY NIKETAN</h1>
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-black mt-0.5">
                    Official Subject Assessment Marksheet
                  </h2>
                  <div className="flex justify-center items-center gap-3 sm:gap-6 text-xs font-bold mt-2 text-black flex-wrap">
                    <span>Class: {cls?.name} {cls?.section}</span>
                    <span>•</span>
                    <span>Subject: {subjectDisplayName}</span>
                    <span>•</span>
                    <span>Term: {selectedTerm} ({academicYear})</span>
                    <span>•</span>
                    <span>Teacher: {profile?.name || 'Faculty Member'}</span>
                  </div>
                </div>

                {/* Students Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-black border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-black text-black font-bold">
                        <th className="p-1.5 border-r border-black w-12 text-center">Roll</th>
                        <th className="p-1.5 border-r border-black">Student Name</th>
                        {attempts.length > 1 && attempts.map(att => (
                          <th key={att.id} className="p-1.5 border-r border-black text-center min-w-[65px]">
                            <div>{att.attempt_name || `Test ${att.attempt_number}`}</div>
                            <div className="text-[10px] text-slate-600">/{att.raw_max_marks || 25}</div>
                          </th>
                        ))}
                        {components.map(comp => (
                          <th key={comp.id} className="p-1.5 border-r border-black text-center min-w-[70px]">
                            <div>
                              {comp.component_code === 'TEST' && attempts.length > 1 
                                ? 'Weekly Avg' 
                                : comp.component_name}
                            </div>
                            <div className="text-[10px] text-slate-600">
                              /{comp.raw_max_marks} (wt: /{comp.converted_max_marks})
                            </div>
                          </th>
                        ))}
                        <th className="p-1.5 border-r border-black text-center min-w-[60px]">Total</th>
                        <th className="p-1.5 text-center w-16">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/30">
                      {filteredStudents.map(student => {
                        const studentScores = {};
                        const studentStatuses = {};
                        components.forEach(comp => {
                          if (comp.component_code === 'TEST' && attempts.length > 0) {
                            const agg = studentAttemptAggregates[student.id];
                            studentScores[comp.component_code] = agg?.aggregatedScore !== null && agg?.aggregatedScore !== undefined ? agg.aggregatedScore : '';
                            studentStatuses[comp.component_code] = agg?.status || 'MARKED';
                          } else {
                            const key = `${student.id}_${comp.component_code}`;
                            studentScores[comp.component_code] = rawScores[key];
                            studentStatuses[comp.component_code] = statuses[key] || 'MARKED';
                          }
                        });

                        const result = MarksCalculationEngine.calculateStudentResult({
                          components,
                          rawScores: studentScores,
                          statuses: studentStatuses,
                          gradeBoundaries: activePattern?.grade_boundaries || [],
                          roundingRule: activePattern?.rounding_rule || 'ROUND_2_DECIMALS'
                        });

                        return (
                          <tr key={student.id} className="border-b border-black/20 hover:bg-slate-50">
                            <td className="p-1.5 border-r border-black text-center font-bold font-mono">{student.roll_no}</td>
                            <td className="p-1.5 border-r border-black font-semibold">{formatStudentDisplayName(student.name)}</td>
                            {attempts.length > 1 && attempts.map(att => {
                              const attKey = `${student.id}_${att.id}`;
                              const attScore = attemptScores[attKey];
                              const attStatus = attemptStatuses[attKey] || 'MARKED';
                              return (
                                <td key={att.id} className="p-1.5 border-r border-black text-center font-mono">
                                  {attStatus === 'ABSENT' ? 'AB' : attStatus === 'NOT_APPLICABLE' ? 'NA' : (attScore !== '' && attScore !== null && attScore !== undefined ? attScore : '—')}
                                </td>
                              );
                            })}
                            {components.map(comp => {
                              const key = `${student.id}_${comp.component_code}`;
                              const compData = result.componentBreakdown?.find(b => b.componentCode === comp.component_code);
                              let stStatus;
                              let rawVal;
                              if (comp.component_code === 'TEST' && attempts.length > 0) {
                                const agg = studentAttemptAggregates[student.id];
                                rawVal = agg?.aggregatedScore !== null && agg?.aggregatedScore !== undefined ? agg.aggregatedScore : null;
                                stStatus = agg?.status || 'MARKED';
                              } else {
                                stStatus = comp.is_calculated ? compData?.status : (statuses[key] || 'MARKED');
                                rawVal = comp.is_calculated ? compData?.rawScore : rawScores[key];
                              }
                              return (
                                <td key={comp.id} className="p-1.5 border-r border-black text-center font-mono">
                                  {stStatus === 'ABSENT' ? 'AB' : stStatus === 'NOT_APPLICABLE' ? 'NA' : (rawVal !== '' && rawVal !== null && rawVal !== undefined ? rawVal : '—')}
                                </td>
                              );
                            })}
                            <td className="p-1.5 border-r border-black text-center font-mono font-bold">
                              {result.hasAnyMark ? (result.isAllAbsent ? 'AB' : (result.totalConverted ?? '—')) : '—'}
                            </td>
                            <td className="p-1.5 text-center font-bold">
                              {result.grade || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Signatures */}
                <div className="mt-4 pt-3 border-t border-black flex justify-between text-xs text-black font-semibold">
                  <div>Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  <div>Teacher Signature: _______________________</div>
                  <div>Principal Initials: __________</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubjectMarks;
