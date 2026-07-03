import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Trophy, AlertCircle, Medal, Frown } from 'lucide-react';
import { getConversionConstants } from '../pages/SubjectMarks';

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
    // We only want 1st, 2nd, 3rd places
    for (let i = 0; i < 3; i++) {
        if (i < uniqueScores.length) {
            const score = uniqueScores[i];
            const studentsWithScore = studentScores.filter(s => s.total === score);
            topScorers.push({
                rank: i + 1,
                score: score,
                students: studentsWithScore.map(s => s.student.name)
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Academic Performance Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Select Class</label>
              <select className="h-10 px-3 rounded-lg border w-full border-slate-300 focus:ring-brand-500" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                <option value="">-- Choose Class --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Select Subject</label>
              <select className="h-10 px-3 rounded-lg border w-full border-slate-300 focus:ring-brand-500" value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)}>
                <option value="">-- Choose Subject --</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Select Term</label>
              <select className="h-10 px-3 rounded-lg border w-full border-slate-300 focus:ring-brand-500" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
                <option value="Midterm">Mid-Term</option>
                <option value="Finalterm">Final-Term</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-t-4 border-t-emerald-500">
            <CardHeader className="bg-emerald-50 border-b border-emerald-100">
              <CardTitle className="text-emerald-800 flex items-center gap-2">
                <Trophy size={20} className="text-emerald-600" /> Top Scorers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reportData.topScorers.length === 0 ? (
                <div className="p-6 text-center text-slate-500">No marks entered yet.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {reportData.topScorers.map((rankObj) => (
                    <li key={rankObj.rank} className="flex justify-between items-center p-4 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${rankObj.rank === 1 ? 'bg-yellow-400' : rankObj.rank === 2 ? 'bg-slate-300' : 'bg-amber-600'}`}>
                          {rankObj.rank}
                        </div>
                        <span className="font-semibold text-slate-800">{rankObj.students.join(', ')}</span>
                      </div>
                      <div className="font-black text-emerald-600 text-lg">{rankObj.score}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-red-500">
            <CardHeader className="bg-red-50 border-b border-red-100">
              <CardTitle className="text-red-800 flex items-center gap-2">
                <AlertCircle size={20} className="text-red-600" /> Requires Attention (Below 10)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reportData.failures.length === 0 ? (
                <div className="p-6 text-center text-slate-500">No students scored below 10.</div>
              ) : (
                <ul className="divide-y divide-slate-100 max-h-[300px] overflow-auto custom-scrollbar">
                  {reportData.failures.map((scoreObj) => (
                    <li key={scoreObj.student.id} className="flex justify-between items-center p-4 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <Frown className="text-slate-400" size={20} />
                        <span className="font-semibold text-slate-800">{scoreObj.student.name}</span>
                      </div>
                      <div className="font-bold text-red-600 bg-red-100 px-3 py-1 rounded-full">{scoreObj.total}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AcademicReports;
