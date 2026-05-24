import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { ArrowLeft, Printer } from 'lucide-react';
import { getConversionConstants } from './SubjectMarks';

const ReportCards = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { classes, subjects, students, teacherSubjects, marks, attendance, academicYear } = useData();

  const queryParams = new URLSearchParams(location.search);
  const initialTerm = queryParams.get('term') || 'Midterm';
  const [selectedTerm, setSelectedTerm] = useState(initialTerm);

  const handleTermChange = (e) => {
    const newTerm = e.target.value;
    setSelectedTerm(newTerm);
    navigate(`/classes/${classId}/reports?term=${newTerm}`, { replace: true });
  };

  const cls = classes.find(c => c.id === classId);
  const classStudents = students.filter(s => s.class_id === classId);
  
  const classSubjectIds = teacherSubjects[classId] || [];
  
  // Find all subjects that have at least one mark in this class
  const assignedSubjects = subjects.filter(sub => {
    return classStudents.some(student => {
      return Object.keys(marks).some(k => k.startsWith(`${student.id}_${sub.id}_`));
    });
  });

  const { examConv } = getConversionConstants(cls?.name);
  const isICSEClass = cls?.name?.match(/\b(9|10|ix|x)\b/i);
  const isISCClass = cls?.name?.match(/\b(11|12|xi|xii)\b/i);

  // Group definitions
  let groupsToUse = [];
  if (isICSEClass) {
    groupsToUse = [
      { name: 'English', matchers: ['english paper', 'english language', 'english literature'] },
      { name: 'HCG', matchers: ['history', 'civics', 'geography'] },
      { name: 'Science', matchers: ['physics', 'chemistry', 'biology', 'science'] }
    ];
  } else if (isISCClass) {
    groupsToUse = [
      { name: 'English', matchers: ['english paper', 'english language', 'english literature'] }
    ];
  }

  // 1. Calculate totals for each student (same logic as Flowsheet)
  const rawData = classStudents.map(student => {
    let grandTotal = 0;
    // Filter to only subjects the student actually has marks for
    const studentSubjects = assignedSubjects.filter(sub => {
      return Object.keys(marks).some(k => k.startsWith(`${student.id}_${sub.id}_`));
    });

    // Sort subjects to match the specified order
    const subjectOrder = [
      'english language', 'english literature', '2nd language', 'physics', 
      'chemistry', 'biology', 'maths', 'history', 'geography', 
      'computer', 'general knowledge', '3rd language'
    ];
    studentSubjects.sort((a, b) => {
      const idxA = subjectOrder.indexOf(a.name.toLowerCase().trim());
      const idxB = subjectOrder.indexOf(b.name.toLowerCase().trim());
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

    let maxPossibleTotal = studentSubjects.length * (selectedTerm === 'Combined' ? 200 : 100);

    const subjectScores = studentSubjects.map(sub => {
      const getDynamicName = (name) => {
        const lowerName = name.toLowerCase();
        const isSec = lowerName.includes('2nd language') || lowerName.includes('second language');
        const isThird = lowerName.includes('3rd language') || lowerName.includes('third language');
        const isElective = lowerName.includes('elective') || lowerName.includes('evs/math') || lowerName.includes('maths/evs') || lowerName.includes('math/evs');
        const isSixth = lowerName.includes('6th') || lowerName.includes('sixth');
        
        if (isSec && student.second_language && !lowerName.includes(student.second_language.toLowerCase())) {
          return `${name} (${student.second_language})`;
        }
        if (isThird && student.third_language && !lowerName.includes(student.third_language.toLowerCase())) {
          return `${name} (${student.third_language})`;
        }
        if (isElective && student.elective_subject) {
          return student.elective_subject;
        }
        if (isSixth && student.sixth_subject) {
          return student.sixth_subject;
        }
        return name;
      };

      const getVal = (term) => {
        const fullTerm = `${academicYear}_${term}`;
        const val = marks[`${student.id}_${sub.id}_${fullTerm}`];
        return val !== undefined && val !== '' ? Number(val) : 0;
      };

      const mtExam = getVal('Midterm_Exam');
      const mtTest = getVal('Midterm_Test');
      const mtConv = mtExam * (examConv / 100);
      const mtTotal = Math.round(mtConv + mtTest);

      const ftExam = getVal('Finalterm_Exam');
      const ftTest = getVal('Finalterm_Test');
      const ftConv = ftExam * (examConv / 100);
      const ftTotal = Math.round(ftConv + ftTest);

      let subjectTotal = 0;
      if (selectedTerm === 'Midterm') subjectTotal = mtTotal;
      else if (selectedTerm === 'Finalterm') subjectTotal = ftTotal;
      else subjectTotal = mtTotal + ftTotal;

      return { subjectId: sub.id, subjectName: getDynamicName(sub.name), total: subjectTotal };
    });

    let finalSubjectRows = [];
    grandTotal = 0;
    maxPossibleTotal = 0;

    if (groupsToUse.length > 0) {
      // Group the subjects
      const grouped = [];
      const standalone = [];
      
      const findGroup = (name) => {
        const lowerName = name.toLowerCase();
        return groupsToUse.find(g => g.matchers.some(m => lowerName.includes(m)));
      };

      // Group them up
      subjectScores.forEach(score => {
        const group = findGroup(score.subjectName);
        if (group) {
          let existing = grouped.find(g => g.groupName === group.name);
          if (!existing) {
            existing = { groupName: group.name, items: [] };
            grouped.push(existing);
          }
          existing.items.push(score);
        } else {
          standalone.push(score);
        }
      });

      // Construct final rows
      grouped.forEach(g => {
        const sum = g.items.reduce((acc, curr) => acc + curr.total, 0);
        const avg = Math.round(sum / g.items.length);
        grandTotal += avg;
        maxPossibleTotal += (selectedTerm === 'Combined' ? 200 : 100);

        g.items.forEach((item, index) => {
          finalSubjectRows.push({
            ...item,
            marksOut100: item.total,
            isGroupStart: index === 0,
            rowSpan: g.items.length,
            groupTotal: avg,
            isStandalone: false
          });
        });
      });

      standalone.forEach(item => {
        grandTotal += item.total;
        maxPossibleTotal += (selectedTerm === 'Combined' ? 200 : 100);
        finalSubjectRows.push({
          ...item,
          marksOut100: null,
          isGroupStart: true,
          rowSpan: 1,
          groupTotal: item.total,
          isStandalone: true
        });
      });
    } else {
      // Normal non-grouped calculation
      finalSubjectRows = subjectScores.map(item => ({
        ...item,
        marksOut100: null,
        isGroupStart: true,
        rowSpan: 1,
        groupTotal: item.total,
        isStandalone: true
      }));
      grandTotal = subjectScores.reduce((acc, curr) => acc + curr.total, 0);
      maxPossibleTotal = subjectScores.length * (selectedTerm === 'Combined' ? 200 : 100);
    }

    const percentage = maxPossibleTotal > 0 ? (grandTotal / maxPossibleTotal) * 100 : 0;

    // Calculate Attendance
    const stuAtt = attendance ? attendance.filter(a => a.student_id === student.id && a.academic_year === academicYear) : [];
    const totalWorkingDays = stuAtt.length;
    const daysPresent = stuAtt.filter(a => a.status === 'Present' || a.status === 'Late').length;
    const daysHalfDay = stuAtt.filter(a => a.status === 'Half Day').length;
    const effectivePresent = daysPresent + (daysHalfDay * 0.5);
    const attendancePercentage = totalWorkingDays > 0 ? ((effectivePresent / totalWorkingDays) * 100).toFixed(1) : '-';

    return {
      ...student,
      subjectScores: finalSubjectRows,
      grandTotal,
      percentage: percentage.toFixed(1),
      attendanceStats: {
        totalWorkingDays,
        daysPresent: effectivePresent,
        percentage: attendancePercentage
      }
    };
  });

  // 2. Calculate Rank
  const sortedData = [...rawData].sort((a, b) => {
    if (isISCClass) {
      return Number(b.percentage) - Number(a.percentage);
    }
    return b.grandTotal - a.grandTotal;
  });
  
  let currentRank = 1;
  let currentValue = -1;
  sortedData.forEach((student, index) => {
    const compareValue = isISCClass ? Number(student.percentage) : student.grandTotal;
    if (compareValue !== currentValue) {
      currentRank = index + 1;
      currentValue = compareValue;
    }
    student.rank = currentRank;
  });

  // 3. Sort by Roll No for printing
  const reportCardsData = sortedData.sort((a, b) => a.roll_no - b.roll_no);

  const getTermLabel = () => {
    if (selectedTerm === 'Midterm') return 'MID-TERM';
    if (selectedTerm === 'Finalterm') return 'FINAL-TERM';
    return 'COMBINED';
  };

  const getOutOFAmount = () => selectedTerm === 'Combined' ? 200 : 100;

  const hasGroupedSubjects = groupsToUse.length > 0;

  return (
    <div>
      <div className="page-header mb-4 no-print">
        <div>
          <button className="btn btn-outline btn-sm mb-2" onClick={() => navigate(`/classes/${classId}/flowsheet`)}>
            <ArrowLeft size={16} /> Back to Flowsheet
          </button>
          <h1>Report Cards</h1>
          <p>{cls?.name} {cls?.section} - {selectedTerm} Report</p>
        </div>
        <div className="flex gap-4 items-center">
          <select 
            className="input-field" 
            style={{ padding: '0.5rem' }}
            value={selectedTerm}
            onChange={handleTermChange}
          >
            <option value="Midterm">Mid-Term</option>
            <option value="Finalterm">Final-Term</option>
            <option value="Combined">Combined (Annual)</option>
          </select>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={18} /> Print All Cards
          </button>
        </div>
      </div>

      <div className="print-container">
        {reportCardsData.map((student) => (
          <div key={student.id} className="report-card-slip" style={{
            border: '2px solid #000',
            width: '100%',
            maxWidth: '600px',
            margin: '0 auto 2rem auto',
            padding: '1rem',
            fontFamily: '"Times New Roman", Times, serif',
            pageBreakInside: 'avoid',
            background: '#fff',
            color: '#000'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '1rem' }}>
              <tbody>
                <tr>
                  <td colSpan="3" style={{ padding: '0.25rem 0.5rem', border: '1px solid #000', textTransform: 'uppercase' }}>
                    <strong>STUDENT NAME :</strong> {student.name}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.25rem 0.5rem', border: '1px solid #000' }}>
                    <strong>Class :</strong> {cls?.name}
                  </td>
                  <td style={{ padding: '0.25rem 0.5rem', border: '1px solid #000' }}>
                    <strong>Section :</strong> {cls?.section}
                  </td>
                  <td style={{ padding: '0.25rem 0.5rem', border: '1px solid #000' }}>
                    <strong>Roll No:</strong> {student.roll_no}
                  </td>
                </tr>
                <tr>
                  <td colSpan="3" style={{ padding: '0.5rem', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>
                    {getTermLabel()} PROGRESS REPORT CARD - {academicYear}
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '1rem' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #000', padding: '0.25rem 0.5rem', textAlign: 'left', width: hasGroupedSubjects ? '40%' : '60%' }}>Subjects</th>
                  {hasGroupedSubjects && <th style={{ border: '1px solid #000', padding: '0.25rem 0.5rem', textAlign: 'center', width: '30%' }}>Marks out of {getOutOFAmount()}</th>}
                  <th style={{ border: '1px solid #000', padding: '0.25rem 0.5rem', textAlign: 'center', width: hasGroupedSubjects ? '30%' : '40%' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {student.subjectScores.map(score => (
                  <tr key={score.subjectId}>
                    <td style={{ border: '1px solid #000', padding: '0.25rem 0.5rem' }}>{score.subjectName}</td>
                    {hasGroupedSubjects && (
                      <td style={{ border: '1px solid #000', padding: '0.25rem 0.5rem', textAlign: 'center' }}>
                        {score.marksOut100 !== null ? score.marksOut100 : ''}
                      </td>
                    )}
                    {score.isGroupStart && (
                      <td 
                        rowSpan={score.rowSpan} 
                        style={{ border: '1px solid #000', padding: '0.25rem 0.5rem', textAlign: 'center', verticalAlign: 'middle' }}
                      >
                        {score.groupTotal}
                      </td>
                    )}
                  </tr>
                ))}
                <tr>
                  <td colSpan={hasGroupedSubjects ? 2 : 1} style={{ border: '1px solid #000', padding: '0.25rem 0.5rem', fontWeight: 'bold', textTransform: 'uppercase' }}>TOTAL</td>
                  <td style={{ border: '1px solid #000', padding: '0.25rem 0.5rem', textAlign: 'center', fontWeight: 'bold' }}>{student.grandTotal}</td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '0.25rem 0.5rem', width: '60%' }}>RANK IN CLASS</td>
                  <td style={{ border: '1px solid #000', padding: '0.25rem 0.5rem', width: '40%' }}>{student.rank} <span style={{ fontWeight: 'normal', fontSize: '0.9em' }}>(Out of {classStudents.length})</span></td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '0.25rem 0.5rem', textTransform: 'uppercase' }}>PERCENTAGE %</td>
                  <td style={{ border: '1px solid #000', padding: '0.25rem 0.5rem' }}>{student.percentage}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '0.25rem 0.5rem', textTransform: 'uppercase' }}>ATTENDANCE:</td>
                  <td style={{ border: '1px solid #000', padding: '0.25rem 0.5rem' }}>
                    {student.attendanceStats.totalWorkingDays > 0 
                      ? `${student.attendanceStats.daysPresent} / ${student.attendanceStats.totalWorkingDays} Days (${student.attendanceStats.percentage}%)` 
                      : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '0.25rem 0.5rem', textTransform: 'uppercase' }}>CONDUCT:</td>
                  <td style={{ border: '1px solid #000', padding: '0.25rem 0.5rem' }}></td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '0.25rem 0.5rem', textTransform: 'uppercase' }}>PERSONALITY & NEATNESS</td>
                  <td style={{ border: '1px solid #000', padding: '0.25rem 0.5rem' }}></td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
        {reportCardsData.length === 0 && (
          <div className="text-center p-8">No students found to generate reports.</div>
        )}
      </div>
    </div>
  );
};

export default ReportCards;
