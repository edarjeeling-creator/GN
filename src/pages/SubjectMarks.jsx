import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, Save, AlertCircle, CheckCircle2, Upload, Search, 
  Send, Lock, RefreshCw, AlertTriangle, ShieldCheck, Check, Info, FileText 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatStudentDisplayName } from '../utils/studentUtils';
import { MarksCalculationEngine } from '../services/MarksCalculationEngine';
import { MarksWorkflowService } from '../services/MarksWorkflowService';

// Backward compatibility helper for legacy views, flowsheets, and reports
export const getConversionConstants = (className) => {
  if (!className) return { examConv: 75, testMax: 25 };
  const isHigher = /(^|\b|[^a-z0-9])(8|9|10|11|12|viii|ix|x|xi|xii)(?![0-9])/i.test(className);
  return isHigher ? { examConv: 80, testMax: 20 } : { examConv: 75, testMax: 25 };
};

const SubjectMarks = () => {
  const { classId, subjectId } = useParams();
  const navigate = useNavigate();
  const { classes, subjects, students, marks, academicYear } = useData();
  const { profile } = useAuth();

  const cls = classes.find(c => c.id === classId);
  const subject = subjects.find(s => s.id === subjectId);

  // Auto-populated authoritative student roster (No office requests needed)
  const classStudents = useMemo(() => 
    students.filter(s => s.class_id === classId || s.classId === classId).sort((a, b) => a.roll_no - b.roll_no),
  [students, classId]);

  const [selectedTerm, setSelectedTerm] = useState('Midterm');
  const [patterns, setPatterns] = useState([]);
  const [activePattern, setActivePattern] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loadingWorkflow, setLoadingWorkflow] = useState(true);

  // Local state for raw inputs and statuses:
  // rawScores: { `${studentId}_${componentCode}`: stringNumber }
  // statuses:  { `${studentId}_${componentCode}`: 'MARKED' | 'ABSENT' | 'NOT_APPLICABLE' }
  const [rawScores, setRawScores] = useState({});
  const [statuses, setStatuses] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const fileInputRef = useRef(null);

  // 1. Load assessment patterns and resolve active pattern
  useEffect(() => {
    const fetchPatterns = async () => {
      try {
        const list = await MarksWorkflowService.getAssessmentPatterns(academicYear);
        setPatterns(list);
        if (cls) {
          const matched = MarksCalculationEngine.resolvePattern(cls.name, academicYear, list);
          setActivePattern(matched);
        }
      } catch (err) {
        console.error('Error fetching patterns:', err);
      }
    };
    fetchPatterns();
  }, [cls?.name, academicYear]);

  // 2. Load submission status & detailed marks
  const loadSubmissionData = async () => {
    if (!cls || !subject || !profile?.id) return;
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

      if (sub?.id) {
        const details = await MarksWorkflowService.getSubmissionDetailedMarks(sub.id);
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
            if (scoresMap[key] === undefined || scoresMap[key] === '') {
              const legacyTermKey = `${st.id}_${subjectId}_${academicYear}_${selectedTerm}_${code}`;
              if (marks[legacyTermKey] !== undefined && marks[legacyTermKey] !== null) {
                scoresMap[key] = String(marks[legacyTermKey]);
                statusMap[key] = 'MARKED';
              }
            }
          });
        });

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
    loadSubmissionData();
  }, [classId, subjectId, selectedTerm, academicYear, activePattern?.id]);

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
    return [
      { id: 'c-test', component_code: 'TEST', component_name: 'Weekly Test', raw_max_marks: 25, converted_max_marks: 25, display_order: 1 },
      { id: 'c-exam', component_code: 'EXAM', component_name: 'Term Examination', raw_max_marks: 100, converted_max_marks: 75, display_order: 2 }
    ];
  }, [activePattern]);

  // Filter students based on language/elective assignment
  const filteredStudents = useMemo(() => {
    return classStudents.filter(student => {
      const subName = subject?.name?.toLowerCase() || '';
      if (subName.includes('2nd') || subName.includes('second')) return student.second_language ? subName.includes(student.second_language.toLowerCase()) : true;
      if (subName.includes('3rd') || subName.includes('third')) return student.third_language ? subName.includes(student.third_language.toLowerCase()) : true;
      if (subName.includes('elective') || subName.includes('evs/math') || subName.includes('maths/evs') || subName.includes('math/evs')) return student.elective_subject ? subName.includes(student.elective_subject.toLowerCase()) : true;
      if (subName.includes('6th') || subName.includes('sixth')) return student.sixth_subject ? subName.includes(student.sixth_subject.toLowerCase()) : true;
      
      if (globalFilter) {
        const q = globalFilter.toLowerCase();
        const matchesName = student.name?.toLowerCase().includes(q);
        const matchesRoll = String(student.roll_no).includes(q);
        return matchesName || matchesRoll;
      }
      return true;
    });
  }, [classStudents, subject, globalFilter]);

  // Handle Raw Mark Input Change
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
    setRawScores(prev => ({ ...prev, [key]: rawVal }));
    setStatuses(prev => ({ ...prev, [key]: 'MARKED' }));
    setSaveStatus('pending');
  };

  // Handle Status Toggle (Marked / Absent / N/A)
  const handleStatusChange = (studentId, componentCode, newStatus) => {
    if (isReadOnly) return;
    const key = `${studentId}_${componentCode}`;
    setStatuses(prev => ({ ...prev, [key]: newStatus }));
    if (newStatus !== 'MARKED') {
      setRawScores(prev => ({ ...prev, [key]: '' }));
    }
    setSaveStatus('pending');
  };

  // Save Draft
  const handleSaveDraft = async () => {
    if (!submission?.id) return;
    setSaveStatus('saving');
    try {
      const detailedPayload = [];
      const legacyPayload = [];

      classStudents.forEach(st => {
        components.forEach(comp => {
          const key = `${st.id}_${comp.component_code}`;
          const rawVal = rawScores[key];
          const stStatus = statuses[key] || 'MARKED';

          let converted = null;
          if (stStatus === 'MARKED' && rawVal !== '' && rawVal !== undefined) {
            converted = MarksCalculationEngine.convertComponentScore(
              rawVal, 
              comp, 
              activePattern?.rounding_rule || 'ROUND_2_DECIMALS'
            );
          } else if (stStatus === 'ABSENT') {
            converted = 0;
          }

          detailedPayload.push({
            studentId: st.id,
            componentId: comp.id,
            rawScore: rawVal,
            convertedScore: converted,
            status: stStatus
          });

          // Sync with legacy format for compatibility
          const legacyTerm = `${academicYear}_${selectedTerm}_${comp.component_code === 'TEST' ? 'Test' : 'Exam'}`;
          legacyPayload.push({
            student_id: st.id,
            subject_id: subjectId,
            term: legacyTerm,
            score: stStatus === 'ABSENT' ? 0 : (rawVal !== '' && rawVal !== undefined ? Number(rawVal) : null)
          });
        });
      });

      await MarksWorkflowService.saveDraftMarks({
        submissionId: submission.id,
        classId,
        subjectId,
        academicYear,
        term: selectedTerm,
        detailedMarksList: detailedPayload,
        legacyMarksPayload: legacyPayload
      });

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      console.error('Error saving draft:', err);
      setSaveStatus('error');
      alert('Failed to save draft: ' + err.message);
    }
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

    const confirmMsg = `Submit marks for ${cls?.name} - ${subject?.name} (${selectedTerm}) to Coordinator Sir for verification?\n\nOnce submitted, you will not be able to modify these marks unless the Coordinator returns them for correction.`;
    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // 1. Auto-save latest changes first
      await handleSaveDraft();

      // 2. Call server RPC
      await MarksWorkflowService.submitForReview({
        submissionId: submission.id,
        notes: `Submitted by ${profile?.name || 'Teacher'} on ${new Date().toLocaleDateString()}`
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/classes')}>
            <ArrowLeft size={18} className="mr-1" /> Back to Classes
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {cls?.name} — {subject?.name}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Authoritative Student Marks Entry & Automated ERP Calculation
            </p>
          </div>
        </div>

        {/* Term Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          {['Midterm', 'Finalterm'].map(t => (
            <button
              key={t}
              onClick={() => setSelectedTerm(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedTerm === t 
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t === 'Midterm' ? 'Mid-Term Exam' : 'Final-Term Exam'}
            </button>
          ))}
        </div>
      </div>

      {/* Workflow Status Banner */}
      {submission && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
          submission.status === 'LOCKED'
            ? 'bg-slate-900 border-slate-800 text-white'
            : submission.status === 'APPROVED'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
            : submission.status === 'RETURNED_FOR_CORRECTION'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
            : submission.status === 'SUBMITTED' || submission.status === 'RESUBMITTED'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              submission.status === 'LOCKED' ? 'bg-slate-800 text-amber-400' :
              submission.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-500' :
              submission.status === 'RETURNED_FOR_CORRECTION' ? 'bg-rose-500/20 text-rose-500' :
              submission.status === 'SUBMITTED' || submission.status === 'RESUBMITTED' ? 'bg-amber-500/20 text-amber-500' :
              'bg-blue-500/20 text-blue-500'
            }`}>
              {submission.status === 'LOCKED' ? <Lock size={20} /> :
               submission.status === 'APPROVED' ? <CheckCircle2 size={20} /> :
               submission.status === 'RETURNED_FOR_CORRECTION' ? <AlertTriangle size={20} /> :
               <ShieldCheck size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-bold opacity-75">Workflow State:</span>
                <span className="font-mono font-black text-sm px-2 py-0.5 rounded bg-black/10 dark:bg-white/10">
                  {submission.status}
                </span>
              </div>
              <p className="text-xs mt-0.5">
                {submission.status === 'DRAFT' && 'You can enter raw marks and save drafts. When ready, submit to Coordinator Sir.'}
                {(submission.status === 'SUBMITTED' || submission.status === 'RESUBMITTED') && 'Marks submitted. Awaiting Coordinator verification and approval.'}
                {submission.status === 'APPROVED' && 'Approved by Coordinator. Awaiting formal locking for report card printing.'}
                {submission.status === 'LOCKED' && 'Marks locked by Coordinator. Official report card printing is enabled.'}
                {submission.status === 'RETURNED_FOR_CORRECTION' && 'Returned for correction. Please review the Coordinator note below, make changes, and resubmit.'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSaveDraft}
                  disabled={saveStatus === 'saving'}
                  className="flex items-center gap-1.5"
                >
                  <Save size={14} />
                  {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Draft Saved' : 'Save Draft'}
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSubmitForReview}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5"
                >
                  <Send size={14} />
                  {isSubmitting ? 'Submitting...' : 'Submit to Coordinator'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Return Reason Alert (If returned for correction) */}
      {submission?.status === 'RETURNED_FOR_CORRECTION' && submission.return_reason && (
        <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800 text-rose-900 dark:text-rose-200 space-y-1 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-700 dark:text-rose-400">
            <AlertTriangle size={16} /> Coordinator's Correction Request:
          </div>
          <p className="text-sm font-medium pl-6 leading-relaxed">
            "{submission.return_reason}"
          </p>
        </div>
      )}

      {/* Assessment Pattern Information Card */}
      {!activePattern ? (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center gap-3 shadow-sm">
          <AlertTriangle size={24} className="text-amber-600 shrink-0" />
          <div>
            <div className="font-bold text-sm text-amber-800 dark:text-amber-300">
              Assessment configuration incomplete. Please contact Administrator.
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              No active assessment scheme or component rules found for this class and academic year. Evaluation conversions and grading cannot proceed without administrative configuration.
            </p>
          </div>
        </div>
      ) : (
        <Card className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-500/10 text-brand-500 dark:text-emerald-400">
                <Info size={18} />
              </div>
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Active Assessment Pattern: {activePattern.pattern_name} (v{activePattern.version || 1})
                </span>
                <p className="text-slate-500 mt-0.5">
                  Components:{' '}
                  {components.map(c => `${c.component_name} (Raw Max: ${c.raw_max_marks} → Converted: ${c.converted_max_marks})`).join(' | ')}
                </p>
              </div>
            </div>
            <div className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-500" />
              Formula: Converted = Raw × ConvertedMax / RawMax
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student Marks Table */}
      <Card className="border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold">
              Student Roster ({filteredStudents.length} Students Enrolled)
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
                placeholder="Search student or roll no..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3 w-16 text-center">Roll</th>
                <th className="p-3">Student Name</th>
                {components.map(comp => (
                  <th key={comp.id} className="p-3 text-center min-w-[140px]">
                    <div>{comp.component_name}</div>
                    <div className="text-[10px] font-mono text-slate-400 font-normal">
                      Raw /{comp.raw_max_marks} (Weight: /{comp.converted_max_marks})
                    </div>
                  </th>
                ))}
                <th className="p-3 text-center min-w-[100px] bg-slate-200/50 dark:bg-slate-800">
                  <div>Calculated Total</div>
                  <div className="text-[10px] font-mono text-slate-400 font-normal">
                    /{components.reduce((acc, c) => acc + (c.converted_max_marks || c.raw_max_marks), 0)}
                  </div>
                </th>
                <th className="p-3 text-center w-20 bg-slate-200/50 dark:bg-slate-800">
                  Grade
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.map((student, idx) => {
                // Collect scores and statuses for this student
                const studentScores = {};
                const studentStatuses = {};
                components.forEach(comp => {
                  const key = `${student.id}_${comp.component_code}`;
                  studentScores[comp.component_code] = rawScores[key];
                  studentStatuses[comp.component_code] = statuses[key] || 'MARKED';
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
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                      idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/30 dark:bg-slate-900/30'
                    }`}
                  >
                    <td className="p-3 text-center font-mono font-bold text-slate-500">
                      {student.roll_no}
                    </td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">
                      {formatStudentDisplayName(student.name)}
                    </td>

                    {/* Component Inputs */}
                    {components.map(comp => {
                      const key = `${student.id}_${comp.component_code}`;
                      const rawVal = rawScores[key] !== undefined ? rawScores[key] : '';
                      const stStatus = statuses[key] || 'MARKED';
                      const converted = MarksCalculationEngine.convertComponentScore(rawVal, comp);

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
                                  className={`w-24 text-center py-1.5 px-2 font-mono font-bold text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                                    isReadOnly 
                                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                      : 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 shadow-sm'
                                  }`}
                                />
                                {comp.raw_max_marks !== comp.converted_max_marks && rawVal !== '' && (
                                  <span className="block text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    ={converted}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className={`px-3 py-1 font-bold text-[11px] rounded-lg font-mono ${
                                stStatus === 'ABSENT' 
                                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                              }`}>
                                {stStatus}
                              </span>
                            )}

                            {/* Status Toggle buttons (Absent / N/A) */}
                            {!isReadOnly && (
                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  title="Toggle Absent"
                                  onClick={() => handleStatusChange(student.id, comp.component_code, stStatus === 'ABSENT' ? 'MARKED' : 'ABSENT')}
                                  className={`px-1.5 py-0.5 text-[9px] font-black rounded ${
                                    stStatus === 'ABSENT' ? 'bg-rose-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                  }`}
                                >
                                  AB
                                </button>
                                <button
                                  type="button"
                                  title="Toggle Not Applicable"
                                  onClick={() => handleStatusChange(student.id, comp.component_code, stStatus === 'NOT_APPLICABLE' ? 'MARKED' : 'NOT_APPLICABLE')}
                                  className={`px-1.5 py-0.5 text-[9px] font-black rounded ${
                                    stStatus === 'NOT_APPLICABLE' ? 'bg-slate-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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
                    <td className="p-3 text-center bg-slate-50/80 dark:bg-slate-800/40">
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-emerald-300">
                        {result.hasAnyMark ? result.totalConverted : '-'}
                      </span>
                      {result.percentage !== null && (
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {result.percentage}%
                        </span>
                      )}
                    </td>

                    {/* Grade */}
                    <td className="p-3 text-center bg-slate-50/80 dark:bg-slate-800/40">
                      {result.grade ? (
                        <Badge variant="success" className="font-black text-xs px-2 py-0.5">
                          {result.grade}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
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
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-emerald-500" />
            <span>Calculated automatically by Gyanoday ERP based on configured assessment scheme.</span>
          </div>
          <div className="font-mono text-[11px]">
            {filteredStudents.length} Students Listed
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SubjectMarks;
