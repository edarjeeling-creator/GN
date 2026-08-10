import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Trophy, AlertCircle, Medal, Frown, Printer } from 'lucide-react';
import { getConversionConstants } from '../pages/SubjectMarks';
import { getStudentHouse } from '../utils/houseData';

const AcademicReports = () => {
  const { classes, subjects, students, marks, academicYear } = useData();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Midterm');

  const selectedClass = classes.find(c => c.id === selectedClassId);
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

    const studentScores = classStudents.map(student => {
      const examVal = marks[`${student.id}_${selectedSubjectId}_${academicYear}_${termExamKey}`];
      const testVal = marks[`${student.id}_${selectedSubjectId}_${academicYear}_${termTestKey}`];

      // Skip students with completely blank marks
      if ((examVal === undefined || examVal === '') && (testVal === undefined || testVal === '')) {
        return null;
      }

      const conv = calculateConverted(examVal);
      const total = Math.round(conv + (testVal === '' || testVal === undefined ? 0 : Number(testVal)));

      return {
        student,
        total: total > 0 ? total : 0
      };
    }).filter(Boolean);

    // Sort by highest marks descending
    studentScores.sort((a, b) => b.total - a.total);

    const failures = studentScores.filter(s => s.total < 10);
    
    // Calculate unique scores to determine rank
    const uniqueScores = [...new Set(studentScores.map(s => s.total))].sort((a, b) => b - a);
    
    const topScorers = [];
    for (const scoreObj of studentScores) {
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
  }, [selectedClassId, selectedSubjectId, selectedTerm, classStudents, marks, academicYear, examConv]);

  return (
    <div className="space-y-6 print:space-y-4">
      <Card className="no-print">
        <CardHeader className="flex flex-row justify-between items-center pb-2">
          <CardTitle>Academic Performance Report</CardTitle>
          <button onClick={() => window.print()} className="btn btn-primary"><Printer size={16} className="mr-2" /> Print Report</button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1">Select Class</label>
              <select className="h-10 px-3 rounded-lg border w-full border-slate-300 dark:border-slate-700 focus:ring-brand-500 bg-[var(--bg-color)] text-[var(--text-primary)]" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                <option value="">-- Choose Class --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1">Select Subject</label>
              <select className="h-10 px-3 rounded-lg border w-full border-slate-300 dark:border-slate-700 focus:ring-brand-500 bg-[var(--bg-color)] text-[var(--text-primary)]" value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)}>
                <option value="">-- Choose Subject --</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1">Select Term</label>
              <select className="h-10 px-3 rounded-lg border w-full border-slate-300 dark:border-slate-700 focus:ring-brand-500 bg-[var(--bg-color)] text-[var(--text-primary)]" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
                <option value="Midterm">Mid-Term</option>
                <option value="Finalterm">Final-Term</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

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
                        <div className="flex flex-col">
                          <span className="font-semibold text-[var(--text-primary)] print:text-black">{scoreObj.student.name}</span>
                          {getStudentHouse(scoreObj.student.name) && (
                            <span className="text-xs font-medium text-slate-500 print:text-slate-600">
                              House: {getStudentHouse(scoreObj.student.name)}
                            </span>
                          )}
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
                        <div className="flex flex-col">
                          <span className="font-semibold text-[var(--text-primary)] print:text-black">{scoreObj.student.name}</span>
                          {getStudentHouse(scoreObj.student.name) && (
                            <span className="text-xs font-medium text-slate-500 print:text-slate-600">
                              House: {getStudentHouse(scoreObj.student.name)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/50 px-3 py-1 rounded-full print:bg-red-100 print:text-red-700">{scoreObj.total}</div>
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
