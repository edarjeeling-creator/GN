import { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Trophy, AlertCircle, Frown, Printer } from 'lucide-react';
import { getConversionConstants } from '../pages/SubjectMarks';
import { getStudentHouse, getHouseBadgeColor } from '../utils/houseData';

const AcademicReports = ({ preselectedClassId, preselectedSubjectId, preselectedTerm, hideControls }) => {
  const { classes, subjects, students, marks, academicYear } = useData();
  const [internalClassId, setInternalClassId] = useState('');
  const [internalSubjectId, setInternalSubjectId] = useState('');
  const [internalTerm, setInternalTerm] = useState('');
  const [absentStudentIds, setAbsentStudentIds] = useState(new Set());

  const selectedClassId = preselectedClassId || internalClassId;
  const selectedSubjectId = preselectedSubjectId || internalSubjectId;
  const selectedTerm = preselectedTerm || internalTerm || 'Midterm';

  // Fetch detailed marks to accurately detect students marked as ABSENT
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

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const selectedClassName = selectedClass ? `${selectedClass.name || ''} ${selectedClass.section || ''}`.trim() : '';
  const classStudents = students.filter(s => s.class_id === selectedClassId || s.classId === selectedClassId);

  const { examConv } = getConversionConstants(selectedClass?.name);

  const reportData = useMemo(() => {
    if (!selectedClassId || !selectedSubjectId || classStudents.length === 0) return null;

    const termExamKey = selectedTerm === 'Midterm' ? 'Midterm_Exam' : 'Finalterm_Exam';
    const termTestKey = selectedTerm === 'Midterm' ? 'Midterm_Test' : 'Finalterm_Test';

    const calculateConverted = (val) => {
      if (val === '' || val === undefined) return 0;
      return (Number(val) * (examConv / 100));
    };

    const isLegacyAbsent = (val) => {
      if (val === null || val === undefined) return false;
      const str = String(val).trim().toUpperCase();
      return str === 'A' || str === 'ABS' || str === 'ABSENT';
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
    
    // Calculate unique scores to determine rank (exclude absent students from top scorers)
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

  return (
    <div className="space-y-6 print:space-y-4">
      {!hideControls && (
        <Card className="no-print">
          <CardHeader className="flex flex-row justify-between items-center pb-2">
            <CardTitle>Academic Performance Report</CardTitle>
            <button onClick={() => window.print()} className="btn btn-primary"><Printer size={16} className="mr-2" /> Print Report</button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1">Select Class</label>
                <select className="h-10 px-3 rounded-lg border w-full border-slate-300 dark:border-slate-700 focus:ring-brand-500 bg-[var(--bg-color)] text-[var(--text-primary)]" value={selectedClassId} onChange={e => setInternalClassId(e.target.value)}>
                  <option value="">-- Choose Class --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1">Select Subject</label>
                <select className="h-10 px-3 rounded-lg border w-full border-slate-300 dark:border-slate-700 focus:ring-brand-500 bg-[var(--bg-color)] text-[var(--text-primary)]" value={selectedSubjectId} onChange={e => setInternalSubjectId(e.target.value)}>
                  <option value="">-- Choose Subject --</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1">Select Term</label>
                <select className="h-10 px-3 rounded-lg border w-full border-slate-300 dark:border-slate-700 focus:ring-brand-500 bg-[var(--bg-color)] text-[var(--text-primary)]" value={selectedTerm} onChange={e => setInternalTerm(e.target.value)}>
                  <option value="Midterm">Mid-Term</option>
                  <option value="Finalterm">Final-Term</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hideControls && (
        <div className="no-print flex justify-between items-center bg-white p-4 rounded-lg shadow-sm mb-4 border border-slate-200">
           <div>
              <h2 className="text-xl font-bold text-slate-800">Academic Report</h2>
              <p className="text-sm text-slate-500">Print the report for {selectedClass?.name} {selectedClass?.section}</p>
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
                          <span className="font-semibold text-[var(--text-primary)] print:text-black">{scoreObj.student.name}</span>
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
                          <span className="font-semibold text-[var(--text-primary)] print:text-black">{scoreObj.student.name}</span>
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
    </div>
  );
};

export default AcademicReports;
