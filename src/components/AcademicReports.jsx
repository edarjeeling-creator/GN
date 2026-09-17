import { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { 
  Trophy, AlertCircle, Frown, Printer, BookOpen, Copy, 
  CheckCheck, Sparkles 
} from 'lucide-react';
import { getConversionConstants } from '../pages/SubjectMarks';
import { getStudentHouse, getHouseBadgeColor } from '../utils/houseData';
import { formatStudentDisplayName } from '../utils/studentUtils';
import { MarksCalculationEngine } from '../services/MarksCalculationEngine';

const isLegacyAbsent = (val) => {
  if (val === null || val === undefined) return false;
  const str = String(val).trim().toUpperCase();
  return str === 'A' || str === 'ABS' || str === 'ABSENT';
};

const AcademicReports = ({ preselectedClassId, preselectedSubjectId, preselectedTerm, hideControls }) => {
  const { classes, subjects, students, marks, academicYear } = useData();

  // Top-Level View Switcher: 'subject_deep_dive' vs 'assembly_digest'
  const [viewMode, setViewMode] = useState('subject_deep_dive');

  // Single Subject Deep Dive State
  const [internalClassId, setInternalClassId] = useState('');
  const [internalSubjectId, setInternalSubjectId] = useState('');
  const [internalTerm, setInternalTerm] = useState('');
  const [absentStudentIds, setAbsentStudentIds] = useState(new Set());

  const selectedClassId = preselectedClassId || internalClassId;
  const selectedSubjectId = preselectedSubjectId || internalSubjectId;
  const selectedTerm = preselectedTerm || internalTerm || 'Midterm';

  // Tuesday Assembly Digest State
  const [digestTerm, setDigestTerm] = useState('Finalterm');
  const [digestScope, setDigestScope] = useState('ALL'); // 'ALL' | 'SENIOR' | 'JUNIOR' | specific classId
  const [digestAbsentMap, setDigestAbsentMap] = useState(new Set());
  const [loadingDigest, setLoadingDigest] = useState(false);
  const [copiedDigest, setCopiedDigest] = useState(false);

  // 1. Fetch detailed marks for Single Subject View
  useEffect(() => {
    let isCancelled = false;

    const fetchAbsentStatuses = async () => {
      if (!selectedClassId || !selectedSubjectId || !selectedTerm || !academicYear) {
        setAbsentStudentIds(new Set());
        return;
      }

      try {
        const termVariants = [selectedTerm];
        if (selectedTerm === 'Finalterm') termVariants.push('Final-Term', 'Final Term', 'Final_Term');
        if (selectedTerm === 'Midterm') termVariants.push('Mid-Term', 'Mid Term', 'Mid_Term');

        const { data: submissions, error: subError } = await supabase
          .from('class_subject_mark_submissions')
          .select('id')
          .eq('class_id', selectedClassId)
          .eq('subject_id', selectedSubjectId)
          .eq('academic_year', academicYear)
          .in('term', termVariants);

        if (subError) {
          console.warn('Notice fetching submission for report:', subError.message);
          return;
        }

        const subIds = (submissions || []).map(s => s.id);
        if (subIds.length === 0) {
          if (!isCancelled) setAbsentStudentIds(new Set());
          return;
        }

        const { data: details, error: detError } = await supabase
          .from('student_marks_detailed')
          .select('student_id, status')
          .in('submission_id', subIds);

        if (detError) {
          console.warn('Notice fetching detailed marks for report:', detError.message);
          return;
        }

        if (!isCancelled && details) {
          const absents = new Set();
          details.forEach(d => {
            if (d.status && String(d.status).toUpperCase() === 'ABSENT') {
              absents.add(String(d.student_id));
            }
          });
          setAbsentStudentIds(absents);
        }
      } catch (err) {
        console.error('Error fetching absent statuses in AcademicReports:', err);
      }
    };

    fetchAbsentStatuses();

    return () => {
      isCancelled = true;
    };
  }, [selectedClassId, selectedSubjectId, selectedTerm, academicYear]);

  // 2. Fetch school-wide detailed marks for Tuesday Assembly Digest
  useEffect(() => {
    if (viewMode !== 'assembly_digest') return;
    let isCancelled = false;

    const fetchSchoolWideAbsents = async () => {
      setLoadingDigest(true);
      try {
        const termVariants = [digestTerm];
        if (digestTerm === 'Finalterm') termVariants.push('Final-Term', 'Final Term', 'Final_Term');
        if (digestTerm === 'Midterm') termVariants.push('Mid-Term', 'Mid Term', 'Mid_Term');

        const { data: submissions, error: subError } = await supabase
          .from('class_subject_mark_submissions')
          .select('id, class_id, subject_id')
          .eq('academic_year', academicYear)
          .in('term', termVariants);

        if (subError) {
          console.warn('Notice fetching submissions for assembly digest:', subError.message);
          if (!isCancelled) setLoadingDigest(false);
          return;
        }

        if (!submissions || submissions.length === 0) {
          if (!isCancelled) {
            setDigestAbsentMap(new Set());
            setLoadingDigest(false);
          }
          return;
        }

        const subIdToClassSub = {};
        submissions.forEach(s => {
          subIdToClassSub[s.id] = `${s.class_id}_${s.subject_id}`;
        });

        const subIds = submissions.map(s => s.id);
        const { data: details, error: detError } = await supabase
          .from('student_marks_detailed')
          .select('submission_id, student_id, status')
          .in('submission_id', subIds);

        if (detError) {
          console.warn('Notice fetching detailed marks for assembly digest:', detError.message);
          if (!isCancelled) setLoadingDigest(false);
          return;
        }

        if (!isCancelled && details) {
          const absents = new Set();
          details.forEach(d => {
            if (d.status && String(d.status).toUpperCase() === 'ABSENT') {
              const classSub = subIdToClassSub[d.submission_id];
              if (classSub) {
                absents.add(`${d.student_id}_${classSub}`);
              }
            }
          });
          setDigestAbsentMap(absents);
        }
      } catch (err) {
        console.error('Error fetching absents in assembly digest:', err);
      } finally {
        if (!isCancelled) setLoadingDigest(false);
      }
    };

    fetchSchoolWideAbsents();

    return () => {
      isCancelled = true;
    };
  }, [viewMode, digestTerm, academicYear]);

  // Selected Class & Calculation constants for Single Subject View
  const selectedClass = classes.find(c => c.id === selectedClassId);
  const selectedClassName = selectedClass ? `${selectedClass.name || ''} ${selectedClass.section || ''}`.trim() : '';
  const classStudents = students.filter(s => s.class_id === selectedClassId || s.classId === selectedClassId);
  const { examConv } = getConversionConstants(selectedClass?.name);

  // Single Subject Report Data
  const reportData = useMemo(() => {
    if (!selectedClassId || !selectedSubjectId || classStudents.length === 0) return null;

    const termExamKey = selectedTerm === 'Midterm' ? 'Midterm_Exam' : 'Finalterm_Exam';
    const termTestKey = selectedTerm === 'Midterm' ? 'Midterm_Test' : 'Finalterm_Test';

    const calculateConverted = (val) => {
      if (val === '' || val === undefined) return 0;
      return (Number(val) * (examConv / 100));
    };

    const studentScores = classStudents.map(student => {
      const examVal = marks[`${student.id}_${selectedSubjectId}_${academicYear}_${termExamKey}`];
      const testVal = marks[`${student.id}_${selectedSubjectId}_${academicYear}_${termTestKey}`];

      const isMarkedAbsent = 
        absentStudentIds.has(String(student.id)) ||
        isLegacyAbsent(examVal) ||
        isLegacyAbsent(testVal);

      // Skip students with completely blank marks who are not marked absent
      if (!isMarkedAbsent && (examVal === undefined || examVal === '') && (testVal === undefined || testVal === '')) {
        return null;
      }

      const conv = calculateConverted(examVal);
      const total = Math.round(conv + (testVal === '' || testVal === undefined ? 0 : Number(testVal)));

      return {
        student,
        total: total > 0 ? total : 0,
        isAbsent: isMarkedAbsent
      };
    }).filter(Boolean);

    // Sort: students with marks descending, absent students at the bottom
    studentScores.sort((a, b) => {
      if (a.isAbsent && !b.isAbsent) return 1;
      if (!a.isAbsent && b.isAbsent) return -1;
      return b.total - a.total;
    });

    const failures = studentScores.filter(s => s.total < 10 || s.isAbsent);
    
    // Calculate unique scores to determine rank (ties receive the same rank)
    const uniqueScores = [...new Set(studentScores.filter(s => !s.isAbsent).map(s => s.total))].sort((a, b) => b - a);
    
    const topScorers = [];
    for (const scoreObj of studentScores) {
      if (scoreObj.isAbsent) continue;
      const rank = uniqueScores.indexOf(scoreObj.total) + 1;
      if (rank <= 3) {
        topScorers.push({
          ...scoreObj,
          rank
        });
      }
    }

    return {
      topScorers,
      failures,
      totalStudents: studentScores.length
    };
  }, [selectedClassId, selectedSubjectId, selectedTerm, classStudents, marks, academicYear, examConv, absentStudentIds]);

  // Tuesday Assembly Digest Multi-Class Aggregation
  const digestReport = useMemo(() => {
    if (viewMode !== 'assembly_digest') return [];

    const termExamKey = digestTerm === 'Midterm' ? 'Midterm_Exam' : 'Finalterm_Exam';
    const termTestKey = digestTerm === 'Midterm' ? 'Midterm_Test' : 'Finalterm_Test';

    // Filter classes based on selected scope
    const targetClasses = classes.filter(c => {
      if (digestScope === 'ALL') return true;
      const isJunior = /(^|\b)(playgroup|lkg|ukg|nursery|1|2|3|4|i|ii|iii|iv)(\b|$)/i.test(c.name);
      if (digestScope === 'SENIOR') return !isJunior;
      if (digestScope === 'JUNIOR') return isJunior;
      return c.id === digestScope;
    }).sort((a, b) => {
      return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }) || (a.section || '').localeCompare(b.section || '');
    });

    const results = [];

    targetClasses.forEach(clsObj => {
      const clsStudents = students.filter(s => s.class_id === clsObj.id || s.classId === clsObj.id);
      if (!clsStudents.length) return;

      const clsName = `${clsObj.name || ''} ${clsObj.section || ''}`.trim();
      const { examConv: classConv } = getConversionConstants(clsObj.name);

      const subjectsWithMarks = [];

      subjects.forEach(subObj => {
        const scoredStudents = clsStudents.map(student => {
          const examVal = marks[`${student.id}_${subObj.id}_${academicYear}_${termExamKey}`];
          const testVal = marks[`${student.id}_${subObj.id}_${academicYear}_${termTestKey}`];

          const isAbsent = 
            digestAbsentMap.has(`${student.id}_${clsObj.id}_${subObj.id}`) ||
            isLegacyAbsent(examVal) ||
            isLegacyAbsent(testVal);

          if (!isAbsent && (examVal === undefined || examVal === '') && (testVal === undefined || testVal === '')) {
            return null;
          }

          const conv = Number(examVal || 0) * (classConv / 100);
          const total = isAbsent ? 0 : Math.round(conv + Number(testVal || 0));
          const house = student.house || getStudentHouse(student.name, clsName);

          return {
            student,
            total,
            isAbsent,
            house
          };
        }).filter(Boolean);

        if (scoredStudents.length === 0) return;

        const { topScorers, requiresAttention } = MarksCalculationEngine.calculateHonoursAndAttention(scoredStudents, {
          rankingPolicy: 'DENSE',
          requiresAttentionThreshold: 10,
          thresholdType: 'SCORE',
          excludeAbsentFromRanking: true
        });

        subjectsWithMarks.push({
          subject: subObj,
          topScorers,
          requiresAttention,
          totalStudents: scoredStudents.length
        });
      });

      if (subjectsWithMarks.length > 0) {
        results.push({
          classObj: clsObj,
          className: clsName,
          subjects: subjectsWithMarks
        });
      }
    });

    return results;
  }, [viewMode, digestTerm, digestScope, classes, subjects, students, marks, academicYear, digestAbsentMap]);

  // Copy School-Wide Digest to Clipboard
  const handleCopyDigest = () => {
    let text = `🏫 *GYANODAY NIKETAN — TUESDAY ASSEMBLY HONOURS DOSSIER*\n`;
    text += `📅 *Term:* ${digestTerm === 'Midterm' ? 'Mid-Term Exam' : 'Final-Term Exam'} ${academicYear}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (digestReport.length === 0) {
      text += `_No submitted subject marks found for the selected criteria._\n\n`;
    } else {
      digestReport.forEach(cg => {
        text += `🏫 *CLASS ${cg.className}*\n`;
        cg.subjects.forEach(sb => {
          text += `  📖 *${sb.subject.name}*\n`;
          text += `  🏆 *Top Scorers:*\n`;
          if (sb.topScorers.length === 0) {
            text += `    _(No top marks evaluated)_\n`;
          } else {
            sb.topScorers.forEach(s => {
              const medal = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : '🥉';
              const rankStr = s.rank === 1 ? '1st' : s.rank === 2 ? '2nd' : '3rd';
              const houseStr = s.house ? ` (${s.house})` : '';
              text += `    ${medal} ${rankStr}: ${formatStudentDisplayName(s.student.name)}${houseStr} — ${s.total}\n`;
            });
          }
          if (sb.requiresAttention.length > 0) {
            text += `  ⚠️ *Requires Attention (${sb.requiresAttention.length}):*\n`;
            sb.requiresAttention.forEach(s => {
              const houseStr = s.house ? ` (${s.house})` : '';
              const statStr = `${s.total} (Below 10)`;
              text += `    • ${formatStudentDisplayName(s.student.name)}${houseStr} — ${statStr}\n`;
            });
          }
          text += `\n`;
        });
        text += `─────────────────────────\n`;
      });
    }

    text += `_Generated via Gyanoday Niketan ERP_`;
    navigator.clipboard.writeText(text);
    setCopiedDigest(true);
    setTimeout(() => setCopiedDigest(false), 2500);
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Top View Switcher (Subject Deep Dive vs Tuesday Assembly Digest) */}
      {!hideControls && (
        <div className="no-print bg-slate-900 border border-slate-700/80 p-2 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/70 rounded-xl border border-slate-800 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('subject_deep_dive')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                viewMode === 'subject_deep_dive'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <BookOpen size={15} />
              <span>Subject Deep Dive</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('assembly_digest')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                viewMode === 'assembly_digest'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-950/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Trophy size={15} />
              <span>Tuesday Assembly Digest</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                School-Wide
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-400 font-medium px-2">
            {viewMode === 'subject_deep_dive' 
              ? 'Select class & subject to inspect detailed performance breakdown.' 
              : 'Principal’s Tuesday morning assembly briefing across all classes.'}
          </div>
        </div>
      )}

      {/* VIEW 1: SUBJECT DEEP DIVE */}
      {viewMode === 'subject_deep_dive' && (
        <>
          {!hideControls && (
            <Card className="no-print bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row justify-between items-center pb-2">
                <div>
                  <CardTitle className="text-white">Academic Performance Report</CardTitle>
                  <p className="text-xs text-slate-400 mt-0.5">Filter by class, subject, and term to view top rankers & absentees.</p>
                </div>
                <button 
                  onClick={() => window.print()} 
                  disabled={!reportData}
                  className="btn btn-primary disabled:opacity-50"
                >
                  <Printer size={16} className="mr-2" /> Print Report
                </button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1">Select Class</label>
                    <select 
                      className="h-10 px-3 rounded-lg border w-full border-slate-300 dark:border-slate-700 focus:ring-brand-500 bg-[var(--bg-color)] text-[var(--text-primary)]" 
                      value={selectedClassId} 
                      onChange={e => setInternalClassId(e.target.value)}
                    >
                      <option value="">-- Choose Class --</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1">Select Subject</label>
                    <select 
                      className="h-10 px-3 rounded-lg border w-full border-slate-300 dark:border-slate-700 focus:ring-brand-500 bg-[var(--bg-color)] text-[var(--text-primary)]" 
                      value={selectedSubjectId} 
                      onChange={e => setInternalSubjectId(e.target.value)}
                    >
                      <option value="">-- Choose Subject --</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1">Select Term</label>
                    <select 
                      className="h-10 px-3 rounded-lg border w-full border-slate-300 dark:border-slate-700 focus:ring-brand-500 bg-[var(--bg-color)] text-[var(--text-primary)]" 
                      value={selectedTerm} 
                      onChange={e => setInternalTerm(e.target.value)}
                    >
                      <option value="Midterm">Mid-Term</option>
                      <option value="Finalterm">Final-Term</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {hideControls && (
            <div className="no-print flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm mb-4 border border-slate-200 dark:border-slate-800">
               <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">Academic Report</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Print the report for {selectedClass?.name} {selectedClass?.section}</p>
               </div>
               <button onClick={() => window.print()} className="btn btn-primary"><Printer size={16} className="mr-2" /> Print Report</button>
            </div>
          )}

          {reportData && (
            <>
              <style>{`
                @media print {
                  @page {
                    margin: 10mm;
                  }
                }
              `}</style>
              <div className="hidden print:block text-center mb-6 pt-4">
                <h2 className="text-2xl font-bold text-black border-b pb-2 inline-block border-slate-300">
                  {selectedTerm} Term Test Marks {academicYear}
                </h2>
                <p className="text-lg mt-2 font-semibold text-black">
                  Class: {selectedClass?.name} {selectedClass?.section}
                  {selectedSubjectId && ` - ${subjects.find(s => s.id === selectedSubjectId)?.name || ''}`}
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block">
                <Card className="border-t-4 border-t-emerald-500 dark:bg-slate-900 print:shadow-none print:border print:break-inside-avoid print:mb-8">
                  <CardHeader className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900 print:bg-emerald-50">
                    <CardTitle className="text-emerald-800 dark:text-emerald-400 print:text-emerald-800 flex items-center gap-2">
                      <Trophy size={20} className="text-emerald-600 dark:text-emerald-400 print:text-emerald-600" /> Top Scorers
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {reportData.topScorers.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 dark:text-slate-400 print:text-slate-500">No marks entered yet.</div>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-100 print:columns-2 print:gap-8">
                      {reportData.topScorers.map((scoreObj) => (
                        <li key={scoreObj.student.id} className="flex justify-between items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 print:hover:bg-transparent print:break-inside-avoid print:border-b">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${scoreObj.rank === 1 ? 'bg-yellow-500' : scoreObj.rank === 2 ? 'bg-slate-400' : 'bg-amber-600'} print:shadow-none print:border print:border-slate-300 print:text-slate-800 print:bg-white`}>
                              {scoreObj.rank}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-[var(--text-primary)] print:text-black">{formatStudentDisplayName(scoreObj.student.name)}</span>
                              {(() => {
                                const house = scoreObj.student.house || getStudentHouse(scoreObj.student.name, selectedClassName);
                                return house ? (
                                  <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${getHouseBadgeColor(house)} print:border print:text-slate-800 print:bg-slate-100`}>
                                    {house}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </div>
                          <div className="font-black text-emerald-600 dark:text-emerald-400 print:text-emerald-700 text-lg">{scoreObj.total}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-red-500 dark:bg-slate-900 print:shadow-none print:border print:break-inside-avoid print:mb-8">
                <CardHeader className="bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900 print:bg-red-50">
                  <CardTitle className="text-red-800 dark:text-red-400 print:text-red-800 flex items-center gap-2">
                    <AlertCircle size={20} className="text-red-600 dark:text-red-400 print:text-red-600" /> Requires Attention (Below 10)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {reportData.failures.length === 0 ? (
                    <div className="p-6 text-center font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-b-xl border border-emerald-100 dark:border-emerald-900 m-4 flex items-center justify-center gap-2 print:text-emerald-700 print:bg-emerald-50">
                       No Failure
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-100 max-h-[300px] print:max-h-none overflow-auto custom-scrollbar print:columns-2 print:gap-8">
                      {reportData.failures.map((scoreObj) => (
                        <li key={scoreObj.student.id} className="flex justify-between items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 print:hover:bg-transparent print:break-inside-avoid print:border-b">
                          <div className="flex items-center gap-3">
                            <Frown className="text-slate-400 dark:text-slate-500 print:text-slate-400" size={20} />
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-[var(--text-primary)] print:text-black">{formatStudentDisplayName(scoreObj.student.name)}</span>
                              {(() => {
                                const house = scoreObj.student.house || getStudentHouse(scoreObj.student.name, selectedClassName);
                                return house ? (
                                  <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${getHouseBadgeColor(house)} print:border print:text-slate-800 print:bg-slate-100`}>
                                    {house}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </div>
                          {scoreObj.isAbsent ? (
                            <div className="font-bold text-rose-600 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/50 px-3 py-1 rounded-full text-xs tracking-wider uppercase print:border-none print:bg-rose-100 print:text-rose-800">
                              Absent
                            </div>
                          ) : (
                            <div className="font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/50 px-3 py-1 rounded-full print:bg-red-100 print:text-red-700">
                              {scoreObj.total}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              </div>
            </>
          )}
        </>
      )}

      {/* VIEW 2: TUESDAY ASSEMBLY DIGEST (Principal School-Wide Dossier) */}
      {viewMode === 'assembly_digest' && (
        <div className="space-y-6">
          {/* Controls & Filter Bar */}
          <div className="no-print bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Term Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Examination Term
                </label>
                <select
                  value={digestTerm}
                  onChange={e => setDigestTerm(e.target.value)}
                  className="h-10 px-3.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-bold text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  <option value="Finalterm">Final-Term Exam ({academicYear})</option>
                  <option value="Midterm">Mid-Term Exam ({academicYear})</option>
                </select>
              </div>

              {/* Scope Filter */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  School Section
                </label>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setDigestScope('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      digestScope === 'ALL'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Classes
                  </button>
                  <button
                    type="button"
                    onClick={() => setDigestScope('SENIOR')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      digestScope === 'SENIOR'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Senior (5–12)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDigestScope('JUNIOR')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      digestScope === 'JUNIOR'
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Junior (Pre–4)
                  </button>
                </div>
              </div>

              {/* Specific Class Dropdown Jump */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Specific Class
                </label>
                <select
                  value={['ALL', 'SENIOR', 'JUNIOR'].includes(digestScope) ? '' : digestScope}
                  onChange={e => setDigestScope(e.target.value || 'ALL')}
                  className="h-10 px-3 rounded-xl border border-slate-700 bg-slate-950 text-white font-medium text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  <option value="">-- Jump to Class --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyDigest}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                  copiedDigest
                    ? 'bg-emerald-900/60 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {copiedDigest ? <CheckCheck size={16} className="text-emerald-400" /> : <Copy size={16} />}
                <span>{copiedDigest ? 'Copied Dossier!' : 'Copy School-wide Digest'}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-500 hover:to-blue-500 text-white flex items-center gap-2 shadow-md shadow-brand-950/40 transition-all cursor-pointer active:scale-95"
              >
                <Printer size={16} />
                <span>Print Assembly Podium Dossier</span>
              </button>
            </div>
          </div>

          {/* Assembly Digest Print Stylesheet */}
          <style>{`
            @media print {
              @page {
                size: portrait;
                margin: 10mm;
              }
              body {
                background: white !important;
                color: black !important;
              }
              .no-print {
                display: none !important;
              }
              .print-break-inside-avoid {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
            }
          `}</style>

          {/* Printable Official Header */}
          <div className="hidden print:block text-center border-b-2 border-black pb-3 mb-6">
            <h1 className="text-2xl font-black uppercase tracking-wider text-black">Gyanoday Niketan</h1>
            <h2 className="text-base font-bold uppercase tracking-wide text-slate-900 mt-0.5">
              Tuesday Morning Assembly Honours & Attention Dossier
            </h2>
            <div className="flex justify-center items-center gap-4 text-xs font-semibold mt-2 text-slate-700">
              <span><strong>Term:</strong> {digestTerm === 'Midterm' ? 'Mid-Term Exam' : 'Final-Term Exam'} {academicYear}</span>
              <span>•</span>
              <span><strong>Scope:</strong> {digestScope === 'ALL' ? 'All Classes' : digestScope === 'SENIOR' ? 'Senior School' : digestScope === 'JUNIOR' ? 'Junior School' : 'Selected Class'}</span>
              <span>•</span>
              <span><strong>Generated:</strong> {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>

          {/* Loading Indicator */}
          {loadingDigest && (
            <div className="p-12 text-center text-slate-400 no-print">
              <div className="inline-block animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full mb-3" />
              <p className="text-sm font-semibold">Aggregating school-wide assembly records...</p>
            </div>
          )}

          {/* Empty State */}
          {!loadingDigest && digestReport.length === 0 && (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
              <Trophy size={36} className="mx-auto text-slate-500 mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No Submitted Marks Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No marks have been recorded yet for the selected term and school filter. As teachers enter marks in their subject portals, they will automatically appear here.
              </p>
            </div>
          )}

          {/* Class Cards Grid */}
          {!loadingDigest && digestReport.length > 0 && (
            <div className="space-y-6">
              {/* Summary Stats Banner (no-print) */}
              <div className="no-print bg-slate-900/60 border border-slate-800/80 px-4 py-3 rounded-xl flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-400" />
                  <span>
                    Displaying <strong>{digestReport.length}</strong> active classes with{' '}
                    <strong>
                      {digestReport.reduce((acc, c) => acc + c.subjects.length, 0)}
                    </strong>{' '}
                    submitted subjects for {digestTerm === 'Midterm' ? 'Mid-Term' : 'Final-Term'} {academicYear}.
                  </span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  Pass Mark Threshold: ≥ 10
                </span>
              </div>

              {digestReport.map(classGroup => (
                <div 
                  key={classGroup.classObj.id} 
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md print:border print:border-slate-300 print:bg-white print:shadow-none print-break-inside-avoid print:mb-6"
                >
                  {/* Class Header */}
                  <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 to-slate-850 border-b border-slate-800 print:bg-slate-100 print:border-slate-300 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 print:text-slate-900 print:bg-white border border-blue-500/30 print:border-slate-300 flex items-center justify-center font-black text-sm">
                        {classGroup.className.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white print:text-black tracking-tight">
                          Class: {classGroup.className}
                        </h3>
                        <span className="text-xs text-slate-400 print:text-slate-600 font-medium">
                          {classGroup.subjects.length} Subject{classGroup.subjects.length === 1 ? '' : 's'} Evaluated
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Subjects Breakdown */}
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 print:grid-cols-2 print:gap-4 print:p-3">
                    {classGroup.subjects.map(subEntry => (
                      <div 
                        key={subEntry.subject.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/60 print:bg-white print:border print:border-slate-300 p-4 flex flex-col justify-between"
                      >
                        <div>
                          {/* Subject Title */}
                          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 print:border-slate-200">
                            <span className="font-bold text-sm text-white print:text-black">
                              {subEntry.subject.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400 print:text-slate-600 bg-slate-900 print:bg-slate-100 px-2 py-0.5 rounded border border-slate-700 print:border-slate-300">
                              {subEntry.totalStudents} Evaluated
                            </span>
                          </div>

                          {/* Top Scorers (1st, 2nd, 3rd) */}
                          <div className="space-y-1.5 mb-3">
                            <div className="text-[11px] font-bold text-emerald-400 print:text-emerald-800 uppercase tracking-wider flex items-center gap-1 mb-1">
                              <Trophy size={13} />
                              <span>Assembly Honours</span>
                            </div>
                            {subEntry.topScorers.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">No evaluated marks</p>
                            ) : (
                              subEntry.topScorers.map(s => (
                                <div key={s.student.id} className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-900/60 print:hover:bg-transparent">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] text-white shrink-0 ${
                                      s.rank === 1 ? 'bg-yellow-500' : s.rank === 2 ? 'bg-slate-400' : 'bg-amber-600'
                                    } print:text-black print:bg-transparent print:border print:border-slate-400`}>
                                      {s.rank}
                                    </span>
                                    <span className="font-bold text-slate-200 print:text-black truncate">
                                      {formatStudentDisplayName(s.student.name)}
                                    </span>
                                    {s.house && (
                                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${getHouseBadgeColor(s.house)} print:text-slate-800 print:bg-slate-100 print:border-slate-300`}>
                                        {s.house}
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono font-black text-emerald-400 print:text-emerald-800 ml-2">
                                    {s.total}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Requires Attention */}
                          {subEntry.requiresAttention.length > 0 && (
                            <div className="pt-2 border-t border-slate-800/80 print:border-slate-200">
                              <div className="text-[11px] font-bold text-rose-400 print:text-rose-800 uppercase tracking-wider flex items-center gap-1 mb-1">
                                <AlertCircle size={13} />
                                <span>Requires Attention (Below 10) ({subEntry.requiresAttention.length})</span>
                              </div>
                              <div className="space-y-1">
                                {subEntry.requiresAttention.map(s => (
                                  <div key={s.student.id} className="flex items-center justify-between text-xs py-0.5 px-1.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-slate-300 print:text-black truncate">
                                        {formatStudentDisplayName(s.student.name)}
                                      </span>
                                      {s.house && (
                                        <span className={`text-[10px] px-1 py-0 rounded border ${getHouseBadgeColor(s.house)} print:text-slate-800 print:bg-slate-100 print:border-slate-300`}>
                                          {s.house}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono text-[11px] font-bold text-amber-400 print:text-amber-800">
                                      {s.total}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AcademicReports;
