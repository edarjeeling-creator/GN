import React, { useMemo } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Trophy, AlertCircle, Printer, Users } from 'lucide-react';
import { getConversionConstants } from './SubjectMarks';
import { getGrade, getGradeColor } from '../utils/reportUtils';

const ClassTeacherPortal = () => {
  const { classId } = useParams();
  const { profile } = useAuth();
  const { classes, subjects, students, marks, academicYear } = useData();

  const cls = classes.find((c) => c.id === classId);
  const classStudents = students.filter((s) => s.class_id === classId);

  // Security: Check if user is the assigned class teacher, or an admin/principal
  const isClassTeacher = cls?.class_teacher_id === profile?.id;
  const isAdminOrPrincipal = profile?.role === 'admin' || profile?.role === 'principal';

  if (!cls) {
    return <div className="p-8 text-center text-slate-500">Class not found.</div>;
  }

  if (!isClassTeacher && !isAdminOrPrincipal) {
    return <Navigate to="/dashboard" replace />;
  }

  const { examConv } = getConversionConstants(cls?.name);

  // Find all subjects that are assigned/have marks for this class
  const classSubjects = subjects.filter((sub) => {
    return classStudents.some((student) => {
      return Object.keys(marks).some((k) => k.startsWith(`${student.id}_${sub.id}_`));
    });
  });

  const portalData = useMemo(() => {
    if (classStudents.length === 0) return null;

    let classTotalPercentage = 0;
    let totalMarksCounted = 0;
    let highestPercentage = 0;
    let lowestPercentage = 100;
    let studentsWithMissingMarks = [];

    // Identify all optional subjects dynamically based on what students in this class have selected
    const optionalSubjectsInClass = new Set();
    classStudents.forEach(s => {
      if (s.second_language) optionalSubjectsInClass.add(s.second_language.toLowerCase().trim());
      if (s.third_language) optionalSubjectsInClass.add(s.third_language.toLowerCase().trim());
      if (s.elective_subject) optionalSubjectsInClass.add(s.elective_subject.toLowerCase().trim());
      if (s.sixth_subject) optionalSubjectsInClass.add(s.sixth_subject.toLowerCase().trim());
    });

    const isStudentEnrolledIn = (student, subjectName) => {
      const subNameLower = subjectName.toLowerCase().trim();
      
      // If the subject matches a specific optional subject chosen by ANY student in the class
      if (optionalSubjectsInClass.has(subNameLower)) {
        // The student MUST explicitly have it selected
        const matches = 
          (student.second_language?.toLowerCase().trim() === subNameLower) ||
          (student.third_language?.toLowerCase().trim() === subNameLower) ||
          (student.elective_subject?.toLowerCase().trim() === subNameLower) ||
          (student.sixth_subject?.toLowerCase().trim() === subNameLower);
          
        if (!matches) return false;
      }
      
      // Check legacy generic names like "2nd Language", "Elective", etc.
      const isSec = subNameLower.includes('2nd') || subNameLower.includes('second');
      const isThird = subNameLower.includes('3rd') || subNameLower.includes('third');
      const isElective = subNameLower.includes('elective') || subNameLower.includes('evs/math') || subNameLower.includes('maths/evs') || subNameLower.includes('math/evs');
      const isSixth = subNameLower.includes('6th') || subNameLower.includes('sixth');
      
      if (isSec) return student.second_language ? subNameLower.includes(student.second_language.toLowerCase().trim()) : true;
      if (isThird) return student.third_language ? subNameLower.includes(student.third_language.toLowerCase().trim()) : true;
      if (isElective) return student.elective_subject ? subNameLower.includes(student.elective_subject.toLowerCase().trim()) : true;
      if (isSixth) return student.sixth_subject ? subNameLower.includes(student.sixth_subject.toLowerCase().trim()) : true;
      
      return true; // Assume enrolled for core subjects
    };

    const studentScores = classStudents.map((student) => {
      let grandMtTotal = 0;
      let maxPossibleTotal = 0;
      let missingSubjects = [];
      let failingSubjects = [];

      const subjectScores = classSubjects.map((sub) => {
        const getVal = (termStr) => {
          const fullTerm = `${academicYear}_${termStr}`;
          const val = marks[`${student.id}_${sub.id}_${fullTerm}`];
          return val !== undefined && val !== '' ? Number(val) : null;
        };

        // We assume Midterm for the consolidated view, or we could add a term selector.
        // For simplicity, let's stick to Midterm as it's the default in ReportCards.
        const mtExam = getVal('Midterm_Exam');
        const mtTest = getVal('Midterm_Test');

        const isEnrolled = isStudentEnrolledIn(student, sub.name);

        if (mtExam === null && mtTest === null) {
          if (isEnrolled) {
            missingSubjects.push(sub.name);
          }
          return { subjectId: sub.id, total: null };
        }

        const mtConv = (mtExam || 0) * (examConv / 100);
        const mtTotal = Math.round(mtConv + (mtTest || 0));

        grandMtTotal += mtTotal;
        maxPossibleTotal += 100;

        if (mtTotal < 40) {
          failingSubjects.push(sub.name);
        }

        return { subjectId: sub.id, total: mtTotal };
      });

      if (missingSubjects.length > 0) {
        studentsWithMissingMarks.push({ name: student.name, missing: missingSubjects });
      }

      const percentage = maxPossibleTotal > 0 ? (grandMtTotal / maxPossibleTotal) * 100 : 0;
      if (maxPossibleTotal > 0) {
        classTotalPercentage += percentage;
        totalMarksCounted++;
        if (percentage > highestPercentage) highestPercentage = percentage;
        if (percentage < lowestPercentage) lowestPercentage = percentage;
      }

      return {
        ...student,
        subjectScores,
        grandMtTotal,
        percentage: percentage.toFixed(1),
        grade: getGrade(percentage),
        missingSubjects,
        failingSubjects,
      };
    });

    // Rank Calculation
    studentScores.sort((a, b) => b.grandMtTotal - a.grandMtTotal);

    let currentRank = 1;
    let currentValue = -1;
    studentScores.forEach((student, index) => {
      if (student.grandMtTotal !== currentValue) {
        currentRank = index + 1;
        currentValue = student.grandMtTotal;
      }
      student.rank = currentRank;
    });

    // Restore Roll No order for display
    studentScores.sort((a, b) => a.roll_no - b.roll_no);

    const classAverage = totalMarksCounted > 0 ? (classTotalPercentage / totalMarksCounted).toFixed(1) : 0;

    const topScorers = studentScores.filter((s) => s.rank <= 3 && s.maxPossibleTotal !== 0).slice(0, 5);

    return {
      studentScores,
      classAverage,
      highestPercentage: highestPercentage.toFixed(1),
      lowestPercentage: lowestPercentage === 100 ? 0 : lowestPercentage.toFixed(1),
      studentsWithMissingMarks,
      topScorers,
    };
  }, [classStudents, classSubjects, marks, academicYear, examConv]);

  if (!portalData) {
    return <div className="p-8 text-center text-slate-500">No data available for this class.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users size={24} className="text-brand-600" /> Class Teacher Portal
          </h1>
          <p className="text-slate-500">
            {cls.name} {cls.section} - {academicYear}
          </p>
        </div>
        <div className="flex gap-3">
          <Link to={`/classes/${classId}/reports`} className="btn btn-primary flex items-center gap-2">
            <Printer size={18} /> Print All Report Cards
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Class Average</div>
            <div className="text-3xl font-black text-brand-600">{portalData.classAverage}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Highest Marks</div>
            <div className="text-3xl font-black text-emerald-600">{portalData.highestPercentage}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Lowest Marks</div>
            <div className="text-3xl font-black text-red-500">{portalData.lowestPercentage}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Students</div>
            <div className="text-3xl font-black text-slate-700">{classStudents.length}</div>
          </CardContent>
        </Card>
      </div>

      {portalData.studentsWithMissingMarks.length > 0 && (
        <Card className="border-l-4 border-l-amber-500 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-800 flex items-center gap-2 text-lg">
              <AlertCircle size={20} /> Missing Marks Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-amber-700 text-sm mb-3">The following students have missing marks which affects their final calculations:</p>
            <ul className="list-disc pl-5 text-sm text-amber-800 space-y-1">
              {portalData.studentsWithMissingMarks.map((sm, i) => (
                <li key={i}>
                  <strong>{sm.name}</strong>: {sm.missing.join(', ')}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Consolidated Marksheet (Mid-Term)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold w-16">Roll</th>
                <th className="px-4 py-3 font-semibold min-w-[150px]">Student Name</th>
                {classSubjects.map((sub) => (
                  <th key={sub.id} className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                    {sub.name}
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold text-center bg-brand-50/50 text-brand-700">Total</th>
                <th className="px-4 py-3 font-semibold text-center bg-brand-50/50 text-brand-700">%</th>
                <th className="px-4 py-3 font-semibold text-center bg-brand-50/50 text-brand-700">Grade</th>
                <th className="px-4 py-3 font-semibold text-center bg-amber-50/50 text-amber-700">Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {portalData.studentScores.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 text-slate-500 font-medium">{student.roll_no}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">
                    {student.name}
                    {student.missingSubjects.length > 0 && (
                      <span className="block text-[10px] text-amber-500 font-normal">Incomplete</span>
                    )}
                  </td>
                  {classSubjects.map((sub) => {
                    const scoreObj = student.subjectScores.find((s) => s.subjectId === sub.id);
                    const isFailing = scoreObj && scoreObj.total !== null && scoreObj.total < 40; // Assuming 40 is pass mark
                    return (
                      <td
                        key={sub.id}
                        className={`px-4 py-3 text-center ${
                          scoreObj?.total === null
                            ? 'text-slate-300 font-normal'
                            : isFailing
                            ? 'text-red-500 font-bold bg-red-50/30'
                            : 'text-slate-700 font-medium'
                        }`}
                      >
                        {scoreObj?.total !== null ? scoreObj.total : '-'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center font-bold text-brand-700 bg-brand-50/20">{student.grandMtTotal}</td>
                  <td className="px-4 py-3 text-center font-bold text-brand-700 bg-brand-50/20">{student.percentage}%</td>
                  <td
                    className="px-4 py-3 text-center font-bold"
                    style={{ color: getGradeColor(student.grade) }}
                  >
                    {student.grade}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-amber-600 bg-amber-50/20">
                    {student.rank}
                    {student.rank === 1 ? 'st' : student.rank === 2 ? 'nd' : student.rank === 3 ? 'rd' : 'th'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClassTeacherPortal;
