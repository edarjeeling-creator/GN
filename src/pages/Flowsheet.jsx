import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ArrowLeft, Download, Printer, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getConversionConstants } from './SubjectMarks';

const Flowsheet = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { classes, subjects, students, teacherSubjects, marks, academicYear } = useData();
  const [selectedTerm, setSelectedTerm] = useState('Midterm'); // 'Midterm', 'Finalterm', 'Combined'

  const cls = classes.find(c => c.id === classId);
  const classStudents = students.filter(s => s.class_id === classId);
  
  const classSubjectIds = teacherSubjects[classId] || [];
  
  // Find all subjects that have at least one mark in this class
  const assignedSubjects = subjects.filter(sub => {
    return classStudents.some(student => {
      return Object.keys(marks).some(k => k.startsWith(`${student.id}_${sub.id}_`));
    });
  });
  
  // Sort subjects to match the specified order
  const subjectOrder = [
    'english language', 'english literature', '2nd language', 'physics', 
    'chemistry', 'biology', 'maths', 'history', 'geography', 
    'computer', 'general knowledge', '3rd language'
  ];
  assignedSubjects.sort((a, b) => {
    const idxA = subjectOrder.indexOf(a.name.toLowerCase().trim());
    const idxB = subjectOrder.indexOf(b.name.toLowerCase().trim());
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });

  const getDynamicName = (name, student) => {
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

  const { examConv } = getConversionConstants(cls?.name);
  const isICSEClass = cls?.name?.match(/\b(9|10|ix|x)\b/i);
  const isISCClass = cls?.name?.match(/\b(11|12|xi|xii)\b/i);

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

  // 1. Calculate totals for each student
  const rawData = classStudents.map(student => {
    // Filter to only subjects the student actually has marks for
    const studentSubjects = assignedSubjects.filter(sub => {
      return Object.keys(marks).some(k => k.startsWith(`${student.id}_${sub.id}_`));
    });

    let maxPossibleTotal = studentSubjects.length * (selectedTerm === 'Combined' ? 200 : 100);

    const subjectScores = studentSubjects.map(sub => {
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

      return { subjectId: sub.id, subjectName: sub.name, mtTotal, ftTotal, total: subjectTotal };
    });

    let grandTotal = 0;
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
        const sum = g.items.reduce((acc, curr) => acc + curr.total, 0);
        const avg = Math.round(sum / g.items.length);
        grandTotal += avg;
        maxPossibleTotal += (selectedTerm === 'Combined' ? 200 : 100);
      });

      standalone.forEach(item => {
        grandTotal += item.total;
        maxPossibleTotal += (selectedTerm === 'Combined' ? 200 : 100);
      });
    } else {
      grandTotal = subjectScores.reduce((acc, curr) => acc + curr.total, 0);
      maxPossibleTotal = subjectScores.length * (selectedTerm === 'Combined' ? 200 : 100);
    }

    const percentage = maxPossibleTotal > 0 ? (grandTotal / maxPossibleTotal) * 100 : 0;

    return {
      ...student,
      subjectScores,
      grandTotal,
      percentage: percentage.toFixed(1)
    };
  });

  // 2. Sort by total descending to calculate Rank
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

  // 3. Sort back by Roll No for display
  const flowsheetData = sortedData.sort((a, b) => a.roll_no - b.roll_no);

  const handleExportExcel = () => {
    const exportData = flowsheetData.map((row, index) => {
      const rowData = {
        'No.': index + 1,
        'Student\'s Name': row.name,
      };
      assignedSubjects.forEach(sub => {
        const scoreObj = row.subjectScores.find(s => s.subjectId === sub.id);
        rowData[sub.name] = scoreObj ? scoreObj.total : 0;
      });
      rowData['Total'] = row.grandTotal;
      rowData['Per'] = Number(row.percentage);
      rowData['Rank'] = row.rank;
      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Flowsheet");
    XLSX.writeFile(workbook, `${cls?.name}_${cls?.section}_${selectedTerm}_Flowsheet.xlsx`);
  };

  const getTermLabel = () => {
    if (selectedTerm === 'Midterm') return 'MID-TERM';
    if (selectedTerm === 'Finalterm') return 'FINAL-TERM';
    return 'COMBINED';
  };

  return (
    <div>
      <div className="page-header mb-4 flex-wrap gap-4">
        <div>
          <button className="btn btn-outline btn-sm mb-2" onClick={() => navigate('/classes')}>
            <ArrowLeft size={16} /> Back
          </button>
          <h1>Class Flowsheet</h1>
          <p>{cls?.name} {cls?.section} - {academicYear}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select 
            className="input-field" 
            style={{ width: 'auto', padding: '0.5rem' }}
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
          >
            <option value="Midterm">Mid-Term Report</option>
            <option value="Finalterm">Final-Term Report</option>
            <option value="Combined">Combined (Annual)</option>
          </select>
          <button className="btn btn-outline" style={{ borderColor: '#107c41', color: '#107c41' }} onClick={handleExportExcel}>
            <FileSpreadsheet size={18} /> Excel
          </button>
          <button className="btn btn-primary" onClick={() => navigate(`/classes/${classId}/reports?term=${selectedTerm}`)}>
            <Printer size={18} /> Print Reports
          </button>
        </div>
      </div>

      <div className="card p-0" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '1rem', background: '#f8f9fa', borderBottom: '2px solid #000', textAlign: 'center', fontWeight: 'bold' }}>
          CLASS - {cls?.name} {cls?.section} | {getTermLabel()} {academicYear}
        </div>
        <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
          <table className="data-table flowsheet-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#f8f9fa' }}>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem', textAlign: 'center' }}>No.</th>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem', minWidth: '150px' }}>Student's Name</th>
                {assignedSubjects.map(sub => (
                  <th key={sub.id} style={{ border: '1px solid #ccc', padding: '0.5rem', textAlign: 'center', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sub.name.substring(0, 4)}
                  </th>
                ))}
                <th style={{ border: '1px solid #ccc', padding: '0.5rem', textAlign: 'center' }}>Total</th>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem', textAlign: 'center' }}>Per</th>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem', textAlign: 'center' }}>Rank</th>
              </tr>
            </thead>
            <tbody>
              {flowsheetData.map((row, index) => (
                <tr key={row.id}>
                  <td style={{ border: '1px solid #ccc', padding: '0.25rem 0.5rem', textAlign: 'center' }}>{index + 1}</td>
                  <td style={{ border: '1px solid #ccc', padding: '0.25rem 0.5rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {row.name.toUpperCase()}
                  </td>
                  {assignedSubjects.map(sub => {
                    const scoreObj = row.subjectScores.find(s => s.subjectId === sub.id);
                    return (
                      <td key={sub.id} style={{ border: '1px solid #ccc', padding: '0.25rem 0.5rem', textAlign: 'center' }}>
                        {scoreObj ? scoreObj.total : ''}
                      </td>
                    );
                  })}
                  <td style={{ border: '1px solid #ccc', padding: '0.25rem 0.5rem', textAlign: 'center', fontWeight: 'bold' }}>{row.grandTotal}</td>
                  <td style={{ border: '1px solid #ccc', padding: '0.25rem 0.5rem', textAlign: 'center' }}>{row.percentage}</td>
                  <td style={{ border: '1px solid #ccc', padding: '0.25rem 0.5rem', textAlign: 'center', fontWeight: 'bold' }}>{row.rank}</td>
                </tr>
              ))}
              {flowsheetData.length === 0 && (
                <tr>
                  <td colSpan={assignedSubjects.length + 5} className="text-center p-4">No students found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Flowsheet;
