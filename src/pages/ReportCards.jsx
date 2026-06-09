import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Printer, User } from 'lucide-react';
import { getConversionConstants } from './SubjectMarks';

const ReportCards = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { classes, subjects, students, teacherSubjects, marks, attendance, academicYear } = useData();

  const cls = classes.find(c => c.id === classId);
  const classStudents = students.filter(s => s.class_id === classId);
  const [signatureUrl, setSignatureUrl] = useState(null);
  
  useEffect(() => {
    const fetchSig = async () => {
      const { data } = await supabase.from('school_settings').select('setting_value').eq('setting_key', 'principal_signature_url').single();
      if (data && data.setting_value) {
        setSignatureUrl(data.setting_value);
      }
    };
    fetchSig();
  }, []);
  
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

  const getGrade = (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  };

  const getGradeColor = (grade) => {
    if (grade === 'A+' || grade === 'A') return '#16a34a';
    if (grade === 'B+' || grade === 'B') return '#2563eb';
    if (grade === 'C') return '#ca8a04';
    if (grade === 'D') return '#ea580c';
    return '#dc2626';
  };

  // 1. Calculate totals for each student
  const rawData = classStudents.map(student => {
    let grandTotal = 0;
    // Filter to only subjects the student actually has marks for
    const studentSubjects = assignedSubjects.filter(sub => {
      return Object.keys(marks).some(k => k.startsWith(`${student.id}_${sub.id}_`));
    });

    // Sort subjects
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

    let maxPossibleTotal = 0;

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

      const subjectTotal = mtTotal + ftTotal;

      return { 
        subjectId: sub.id, 
        subjectName: getDynamicName(sub.name), 
        mtTotal, 
        ftTotal, 
        total: subjectTotal 
      };
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

      grouped.forEach(g => {
        const sumMt = g.items.reduce((acc, curr) => acc + curr.mtTotal, 0);
        const avgMt = Math.round(sumMt / g.items.length);

        const sumFt = g.items.reduce((acc, curr) => acc + curr.ftTotal, 0);
        const avgFt = Math.round(sumFt / g.items.length);

        const sumTotal = g.items.reduce((acc, curr) => acc + curr.total, 0);
        const avgTotal = Math.round(sumTotal / g.items.length);

        grandTotal += avgTotal;
        maxPossibleTotal += 200;

        g.items.forEach((item, index) => {
          finalSubjectRows.push({
            ...item,
            isGroupStart: index === 0,
            rowSpan: g.items.length,
            groupMtTotal: avgMt,
            groupFtTotal: avgFt,
            groupTotal: avgTotal,
            isStandalone: false
          });
        });
      });

      standalone.forEach(item => {
        grandTotal += item.total;
        maxPossibleTotal += 200;
        finalSubjectRows.push({
          ...item,
          isGroupStart: true,
          rowSpan: 1,
          groupMtTotal: item.mtTotal,
          groupFtTotal: item.ftTotal,
          groupTotal: item.total,
          isStandalone: true
        });
      });
    } else {
      finalSubjectRows = subjectScores.map(item => ({
        ...item,
        isGroupStart: true,
        rowSpan: 1,
        groupMtTotal: item.mtTotal,
        groupFtTotal: item.ftTotal,
        groupTotal: item.total,
        isStandalone: true
      }));
      grandTotal = subjectScores.reduce((acc, curr) => acc + curr.total, 0);
      maxPossibleTotal = subjectScores.length * 200;
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
      maxPossibleTotal,
      percentage: percentage.toFixed(1),
      grade: getGrade(percentage),
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

  const hasGroupedSubjects = groupsToUse.length > 0;

  return (
    <div>
      <div className="page-header mb-4 no-print">
        <div>
          <button className="btn btn-outline btn-sm mb-2" onClick={() => navigate(`/classes/${classId}/flowsheet`)}>
            <ArrowLeft size={16} /> Back to Flowsheet
          </button>
          <h1>Annual Report Cards</h1>
          <p>{cls?.name} {cls?.section} - Modern A4 Layout</p>
        </div>
        <div className="flex gap-4 items-center">
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={18} /> Print All Cards
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            padding: 0;
            background: white;
          }
          .a4-page {
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 15mm;
            page-break-after: always;
            box-sizing: border-box;
            background: white;
          }
          /* Ensure last page doesn't have an empty page after it */
          .a4-page:last-child {
            page-break-after: auto;
          }
        }

        .a4-page {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto 2rem auto;
          padding: 15mm;
          background: white;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: #1e293b;
          box-sizing: border-box;
          position: relative;
        }

        .rc-header {
          text-align: center;
          margin-bottom: 8mm;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 4mm;
        }
        .rc-title {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #0f172a;
          margin: 0 0 4px 0;
        }
        .rc-subtitle {
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          margin: 0;
        }

        .rc-student-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8mm;
          background: #f8fafc;
          padding: 6mm;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .rc-student-info {
          flex: 1;
        }

        .rc-info-row {
          display: flex;
          margin-bottom: 4px;
          font-size: 14px;
        }
        .rc-info-label {
          width: 100px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          font-size: 12px;
        }
        .rc-info-val {
          font-weight: 600;
          color: #0f172a;
        }

        .rc-photo-container {
          width: 25mm;
          height: 30mm;
          border: 2px solid #cbd5e1;
          border-radius: 4px;
          overflow: hidden;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 10mm;
          flex-shrink: 0;
          position: relative;
        }
        .rc-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .rc-photo-placeholder {
          color: #94a3b8;
        }

        .rc-rank-badge {
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          background: #f59e0b;
          color: white;
          font-weight: 800;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 12px;
          white-space: nowrap;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .rc-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 8mm;
          font-size: 13px;
        }
        .rc-table th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.5px;
          padding: 8px;
          border: 1px solid #cbd5e1;
          text-align: center;
        }
        .rc-table th:first-child {
          text-align: left;
        }
        .rc-table td {
          padding: 8px;
          border: 1px solid #cbd5e1;
          text-align: center;
          color: #1e293b;
        }
        .rc-table td:first-child {
          text-align: left;
          font-weight: 500;
        }
        
        .rc-group-total {
          font-weight: 700;
          background: #f8fafc;
        }

        .rc-summary-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6mm;
          margin-bottom: 8mm;
        }
        .rc-summary-box {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 4mm;
        }
        .rc-box-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          margin: 0 0 4px 0;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 2px;
        }
        .rc-summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          margin-top: 6px;
        }
        .rc-stat {
          display: flex;
          flex-direction: column;
        }
        .rc-stat-label {
          font-size: 10px;
          color: #64748b;
          text-transform: uppercase;
        }
        .rc-stat-val {
          font-size: 14px;
          font-weight: 700;
        }

        .rc-remarks-section {
          margin-bottom: 12mm;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 4mm;
          min-height: 25mm;
        }

        .rc-signatures {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: auto;
          position: absolute;
          bottom: 15mm;
          left: 15mm;
          right: 15mm;
        }
        .rc-sig-block {
          text-align: center;
          width: 50mm;
        }
        .rc-sig-line {
          border-top: 1px solid #64748b;
          margin-bottom: 4px;
        }
        .rc-sig-label {
          font-size: 12px;
          color: #475569;
          font-weight: 600;
        }

      `}</style>

      <div className="print-container">
        {reportCardsData.map((student) => (
          <div key={student.id} className="a4-page">
            
            {/* Header */}
            <div className="rc-header">
              <h1 className="rc-title">Annual Progress Report</h1>
              <p className="rc-subtitle">Academic Session {academicYear}</p>
            </div>

            {/* Student Info */}
            <div className="rc-student-section">
              <div className="rc-student-info">
                <div className="rc-info-row">
                  <div className="rc-info-label">Name:</div>
                  <div className="rc-info-val" style={{ fontSize: '16px', textTransform: 'uppercase' }}>{student.name}</div>
                </div>
                <div className="rc-info-row mt-2">
                  <div className="rc-info-label">Class:</div>
                  <div className="rc-info-val">{cls?.name}</div>
                </div>
                <div className="rc-info-row">
                  <div className="rc-info-label">Section:</div>
                  <div className="rc-info-val">{cls?.section}</div>
                </div>
                <div className="rc-info-row">
                  <div className="rc-info-label">Roll No:</div>
                  <div className="rc-info-val">{student.roll_no}</div>
                </div>
              </div>
              <div className="rc-photo-container">
                {student.picture_url ? (
                  <img src={student.picture_url} alt={student.name} className="rc-photo" />
                ) : (
                  <User size={40} className="rc-photo-placeholder" />
                )}
              </div>
            </div>

            {/* Academic Performance Table */}
            <table className="rc-table">
              <thead>
                <tr>
                  <th style={{ width: hasGroupedSubjects ? '30%' : '40%' }}>Scholastic Subjects</th>
                  <th>Mid-Term<br/><span style={{fontWeight: 500, fontSize: '9px'}}>(100)</span></th>
                  <th>Final-Term<br/><span style={{fontWeight: 500, fontSize: '9px'}}>(100)</span></th>
                  {hasGroupedSubjects && <th>Group Total<br/><span style={{fontWeight: 500, fontSize: '9px'}}>(200)</span></th>}
                  <th>Annual Total<br/><span style={{fontWeight: 500, fontSize: '9px'}}>(200)</span></th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {student.subjectScores.map(score => {
                  const annTotal = score.total;
                  const annPerc = (annTotal / 200) * 100;
                  const annGrade = getGrade(annPerc);

                  return (
                    <tr key={score.subjectId}>
                      <td>{score.subjectName}</td>
                      <td>{score.mtTotal}</td>
                      <td>{score.ftTotal}</td>
                      
                      {/* Group Total Handling */}
                      {hasGroupedSubjects && score.isGroupStart && (
                        <td rowSpan={score.rowSpan} className="rc-group-total">
                          {score.groupTotal}
                        </td>
                      )}
                      
                      {/* Annual Total column */}
                      {(!hasGroupedSubjects || score.isGroupStart) && (
                        <td rowSpan={hasGroupedSubjects ? score.rowSpan : 1} className={hasGroupedSubjects ? "rc-group-total" : ""}>
                          {hasGroupedSubjects ? score.groupTotal : annTotal}
                        </td>
                      )}

                      {/* Grade Column */}
                      {(!hasGroupedSubjects || score.isGroupStart) && (
                        <td rowSpan={hasGroupedSubjects ? score.rowSpan : 1} style={{ fontWeight: 'bold', color: getGradeColor(hasGroupedSubjects ? getGrade((score.groupTotal/200)*100) : annGrade) }}>
                          {hasGroupedSubjects ? getGrade((score.groupTotal/200)*100) : annGrade}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Overall Summary & Attendance */}
            <div className="rc-summary-section">
              <div className="rc-summary-box">
                <h4 className="rc-box-title">Overall Performance</h4>
                <div className="rc-summary-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <div className="rc-stat">
                    <span className="rc-stat-label">Max Marks</span>
                    <span className="rc-stat-val">{student.maxPossibleTotal}</span>
                  </div>
                  <div className="rc-stat">
                    <span className="rc-stat-label">Marks Obtained</span>
                    <span className="rc-stat-val">{student.grandTotal}</span>
                  </div>
                  <div className="rc-stat">
                    <span className="rc-stat-label">Percentage</span>
                    <span className="rc-stat-val">{student.percentage}%</span>
                  </div>
                  <div className="rc-stat mt-2">
                    <span className="rc-stat-label">Overall Grade</span>
                    <span className="rc-stat-val" style={{ color: getGradeColor(student.grade), fontSize: '18px' }}>{student.grade}</span>
                  </div>
                  <div className="rc-stat mt-2">
                    <span className="rc-stat-label">Rank</span>
                    <span className="rc-stat-val">{student.rank}</span>
                  </div>
                </div>
              </div>

              <div className="rc-summary-box">
                <h4 className="rc-box-title">Attendance & Co-Scholastic</h4>
                <div className="rc-summary-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <div className="rc-stat">
                    <span className="rc-stat-label">Work. Days</span>
                    <span className="rc-stat-val">{student.attendanceStats.totalWorkingDays || '-'}</span>
                  </div>
                  <div className="rc-stat">
                    <span className="rc-stat-label">Present</span>
                    <span className="rc-stat-val">{student.attendanceStats.daysPresent || '-'}</span>
                  </div>
                  <div className="rc-stat">
                    <span className="rc-stat-label">Att. %</span>
                    <span className="rc-stat-val">{student.attendanceStats.percentage}%</span>
                  </div>
                  
                  <div className="rc-stat mt-2">
                    <span className="rc-stat-label">Discipline</span>
                    <span className="rc-stat-val text-green-600">A</span>
                  </div>
                  <div className="rc-stat mt-2">
                    <span className="rc-stat-label">Leadership</span>
                    <span className="rc-stat-val text-blue-600">B+</span>
                  </div>
                  <div className="rc-stat mt-2">
                    <span className="rc-stat-label">Neatness</span>
                    <span className="rc-stat-val text-green-600">A</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="rc-remarks-section">
              <h4 className="rc-box-title">Class Teacher Remarks</h4>
              <p style={{ marginTop: '8px', fontSize: '13px', color: '#334155', fontStyle: 'italic', lineHeight: 1.6 }}>
                {/* Placeholder for remarks until backend field is added */}
                {student.percentage >= 80 ? 'An outstanding performance! Keep up the excellent work.' : 
                 student.percentage >= 60 ? 'Good effort this session. With more focus, further improvement is possible.' : 
                 'Needs more attention to studies and regular revision to improve grades in the next session.'}
              </p>
            </div>

            {/* Signatures */}
            <div className="rc-signatures">
              <div className="rc-sig-block">
                <div className="rc-sig-line"></div>
                <div className="rc-sig-label">Class Teacher</div>
              </div>
              <div className="rc-sig-block">
                {signatureUrl ? (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2px', height: '40px' }}>
                    <img src={signatureUrl} alt="Principal Signature" style={{ maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                ) : <div style={{ height: '40px' }}></div>}
                <div className="rc-sig-line"></div>
                <div className="rc-sig-label">Principal</div>
              </div>
              <div className="rc-sig-block">
                <div className="rc-sig-line"></div>
                <div className="rc-sig-label">Parent/Guardian</div>
              </div>
            </div>

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
