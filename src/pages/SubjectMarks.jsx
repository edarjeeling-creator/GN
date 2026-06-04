import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ArrowLeft, Save, AlertCircle, CheckCircle2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

export const getConversionConstants = (className) => {
  if (!className) return { examConv: 75, testMax: 25 };
  const isHigher = /(9|10|11|12|ix|x|xi|xii)\b/i.test(className);
  return isHigher ? { examConv: 80, testMax: 20 } : { examConv: 75, testMax: 25 };
};

const SubjectMarks = () => {
  const { classId, subjectId } = useParams();
  const navigate = useNavigate();
  const { classes, subjects, students, marks, updateMark, academicYear } = useData();

  const cls = classes.find(c => c.id === classId);
  const subject = subjects.find(s => s.id === subjectId);
  const classStudents = students.filter(s => s.class_id === classId || s.classId === classId).sort((a, b) => a.roll_no - b.roll_no);
  
  const { examConv, testMax } = getConversionConstants(cls?.name);

  const [localMarks, setLocalMarks] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, saved, error
  
  // Filter students based on 2nd/3rd language if the subject specifies one
  const filteredStudents = classStudents.filter(student => {
    const subName = subject?.name?.toLowerCase() || '';
    
    // Check if it's a 2nd language subject
    if (subName.includes('2nd') || subName.includes('second')) {
      // If student has a second language set, check if the subject name contains it
      if (student.second_language) {
        return subName.includes(student.second_language.toLowerCase());
      }
      return true; // If student hasn't been assigned a language yet, show them by default
    }
    
    // Check if it's a 3rd language subject
    if (subName.includes('3rd') || subName.includes('third')) {
      if (student.third_language) {
        return subName.includes(student.third_language.toLowerCase());
      }
      return true;
    }
    
    // Check if it's an elective (Maths/EVS)
    if (subName.includes('elective') || subName.includes('evs/math') || subName.includes('maths/evs') || subName.includes('math/evs')) {
      if (student.elective_subject) {
        return subName.includes(student.elective_subject.toLowerCase());
      }
      return true;
    }

    // Check if it's a 6th subject
    if (subName.includes('6th') || subName.includes('sixth')) {
      if (student.sixth_subject) {
        return subName.includes(student.sixth_subject.toLowerCase());
      }
      return true;
    }
    
    // Not a language subject, show everyone
    return true;
  });

  const [search, setSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Midterm'); // Added Term Selector
  const fileInputRef = useRef(null);

  const isSecondLanguage = subject?.name.toLowerCase().includes('2nd language') || subject?.name.toLowerCase().includes('second language');
  const isThirdLanguage = subject?.name.toLowerCase().includes('3rd language') || subject?.name.toLowerCase().includes('third language');
  const isElective = subject?.name.toLowerCase().includes('elective') || subject?.name.toLowerCase().includes('evs/math') || subject?.name.toLowerCase().includes('maths/evs') || subject?.name.toLowerCase().includes('math/evs');
  const isSixthSubject = subject?.name.toLowerCase().includes('6th') || subject?.name.toLowerCase().includes('sixth');
  const hasLanguageOptions = isSecondLanguage || isThirdLanguage || isElective || isSixthSubject;

  const uniqueLanguages = [...new Set(classStudents.map(s => {
    if (isSecondLanguage) return s.second_language;
    if (isThirdLanguage) return s.third_language;
    if (isElective) return s.elective_subject;
    if (isSixthSubject) return s.sixth_subject;
    return null;
  }).filter(Boolean))];

  // Initialize local marks
  const studentIdsString = classStudents.map(s => s.id).join(',');
  
  useEffect(() => {
    const initialMarks = {};
    classStudents.forEach(student => {
      ['Midterm_Exam', 'Midterm_Test', 'Finalterm_Exam', 'Finalterm_Test'].forEach(term => {
        const fullTerm = `${academicYear}_${term}`;
        const key = `${student.id}_${subjectId}_${fullTerm}`;
        initialMarks[key] = marks[key] || '';
      });
    });
    setLocalMarks(initialMarks);
  }, [studentIdsString, marks, subjectId, academicYear]);

  const handleMarkChange = (studentId, term, value) => {
    // Basic validation
    let maxMark = 100;
    if (term.includes('Test')) maxMark = testMax;
    
    if (value !== '' && (isNaN(value) || value < 0 || value > maxMark)) {
      return; 
    }
    const fullTerm = `${academicYear}_${term}`;
    const key = `${studentId}_${subjectId}_${fullTerm}`;
    setLocalMarks(prev => ({ ...prev, [key]: value }));
    setSaveStatus('pending');
  };

  const handleBlur = (studentId, term) => {
    const fullTerm = `${academicYear}_${term}`;
    const key = `${studentId}_${subjectId}_${fullTerm}`;
    const value = localMarks[key];
    if (value !== marks[key]) {
      setSaveStatus('saving');
      // Simulate network request delay for UX
      setTimeout(() => {
        updateMark(studentId, subjectId, term, value === '' ? '' : Number(value));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }, 400);
    }
  };

  const calculateConverted = (val) => {
    if (val === '' || val === undefined) return 0;
    return (Number(val) * (examConv / 100));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        let newLocalMarks = { ...localMarks };
        let changesMade = false;

        data.forEach(row => {
          // Look for Roll No or Roll Number
          const rollNo = row['Roll No'] || row['Roll'] || row['roll_no'];
          if (!rollNo) return;

          const student = classStudents.find(s => Number(s.roll_no) === Number(rollNo));
          if (!student) return;

          const setMarkIfPresent = (colName, term) => {
            const val = row[colName];
            if (val !== undefined && val !== null) {
              const fullTerm = `${academicYear}_${term}`;
              const key = `${student.id}_${subjectId}_${fullTerm}`;
              newLocalMarks[key] = val === '' ? '' : Number(val);
              changesMade = true;
            }
          };

          setMarkIfPresent('Mid Exam', 'Midterm_Exam');
          setMarkIfPresent('Mid Test', 'Midterm_Test');
          setMarkIfPresent('Final Exam', 'Finalterm_Exam');
          setMarkIfPresent('Final Test', 'Finalterm_Test');
        });

        if (changesMade) {
          setLocalMarks(newLocalMarks);
          setSaveStatus('pending');
        }
        alert('Excel imported successfully! Please review the numbers and click "Save All".');
      } catch (err) {
        console.error(err);
        alert('Error parsing Excel file. Make sure it has columns: Roll No, Mid Exam, Mid Test, Final Exam, Final Test');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const visibleStudents = filteredStudents.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    
    if (hasLanguageOptions && languageFilter) {
      let studentLang = null;
      if (isSecondLanguage) studentLang = s.second_language;
      else if (isThirdLanguage) studentLang = s.third_language;
      else if (isElective) studentLang = s.elective_subject;
      else if (isSixthSubject) studentLang = s.sixth_subject;
      
      if (!studentLang || !studentLang.toLowerCase().includes(languageFilter.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  return (
    <div>
      <div className="page-header mb-4">
        <div>
          <button className="btn btn-outline btn-sm mb-2" onClick={() => navigate('/classes')}>
            <ArrowLeft size={16} /> Back to Classes
          </button>
          <h1>Marks Entry: {subject?.name}</h1>
          <p>{cls?.name} {cls?.section} (Exam translates to {examConv}, Test is out of {testMax})</p>
        </div>
        <div className="flex items-center gap-4">
          {saveStatus === 'pending' && <span className="text-warning flex items-center gap-1"><AlertCircle size={16}/> Unsaved changes</span>}
          {saveStatus === 'saving' && <span className="text-text-secondary">Saving...</span>}
          {saveStatus === 'saved' && <span className="text-success flex items-center gap-1"><CheckCircle2 size={16}/> Saved</span>}
          
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} /> Import Excel
          </button>
          
          <button className="btn btn-primary" onClick={() => {
             Object.entries(localMarks).forEach(([key, val]) => {
                if(val !== marks[key]) {
                  const [studentId, _, term] = key.split('_');
                  updateMark(studentId, subjectId, term, val === '' ? '' : Number(val));
                }
             });
             setSaveStatus('saved');
             setTimeout(() => setSaveStatus('idle'), 2000);
          }}>
            <Save size={18} /> Save All
          </button>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="flex justify-between mb-4 flex-wrap gap-2">
          <input 
            type="text" 
            placeholder="Search student..." 
            className="input-field" 
            style={{ maxWidth: '300px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          
          {hasLanguageOptions && (
            <select 
              className="input-field" 
              style={{ maxWidth: '200px' }}
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
            >
              <option value="">All Languages</option>
              {uniqueLanguages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          )}

          <select 
            className="input-field" 
            style={{ maxWidth: '200px', fontWeight: 'bold' }}
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
          >
            <option value="Midterm">Mid-Term</option>
            <option value="Finalterm">Final-Term</option>
          </select>
        </div>

        <div className="table-container">
          <table className="data-table" style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th rowSpan="2" style={{ verticalAlign: 'middle', width: '80px' }}>Roll No</th>
                <th rowSpan="2" style={{ verticalAlign: 'middle', minWidth: '250px' }}>Student Name</th>
                {selectedTerm === 'Midterm' && <th colSpan="4" className="text-center" style={{ borderLeft: '2px solid var(--border-color)', backgroundColor: 'rgba(37, 99, 235, 0.05)' }}>Mid-Term</th>}
                {selectedTerm === 'Finalterm' && <th colSpan="4" className="text-center" style={{ borderLeft: '2px solid var(--border-color)', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>Final-Term</th>}
              </tr>
              <tr>
                {selectedTerm === 'Midterm' && (
                  <>
                    <th className="text-center" style={{ borderLeft: '2px solid var(--border-color)' }}>Exam (100)</th>
                    <th className="text-center text-text-secondary">Conv ({examConv})</th>
                    <th className="text-center">Test ({testMax})</th>
                    <th className="text-center text-primary font-bold">Total (100)</th>
                  </>
                )}
                {selectedTerm === 'Finalterm' && (
                  <>
                    <th className="text-center" style={{ borderLeft: '2px solid var(--border-color)' }}>Exam (100)</th>
                    <th className="text-center text-text-secondary">Conv ({examConv})</th>
                    <th className="text-center">Test ({testMax})</th>
                    <th className="text-center text-success font-bold">Total (100)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map(student => {
                const getVal = (term) => {
                  const fullTerm = `${academicYear}_${term}`;
                  const val = localMarks[`${student.id}_${subjectId}_${fullTerm}`];
                  return val !== undefined ? val : '';
                };

                const mtExam = getVal('Midterm_Exam');
                const mtTest = getVal('Midterm_Test');
                const mtConv = calculateConverted(mtExam);
                const rawMtTotal = mtConv + (mtTest === '' ? 0 : Number(mtTest));
                const mtTotal = rawMtTotal > 0 ? Math.round(rawMtTotal) : 0;

                const ftExam = getVal('Finalterm_Exam');
                const ftTest = getVal('Finalterm_Test');
                const ftConv = calculateConverted(ftExam);
                const rawFtTotal = ftConv + (ftTest === '' ? 0 : Number(ftTest));
                const ftTotal = rawFtTotal > 0 ? Math.round(rawFtTotal) : 0;

                return (
                  <tr key={student.id}>
                    <td>{student.roll_no}</td>
                    <td style={{ fontWeight: 500 }}>
                      <div className="flex items-center gap-3">
                        <img 
                          src={student.picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`} 
                          alt={student.name} 
                          style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        {student.name}
                      </div>
                    </td>
                    
                    {/* Midterm */}
                    {selectedTerm === 'Midterm' && (
                      <>
                        <td className="text-center" style={{ borderLeft: '2px solid var(--border-color)' }}>
                          <input type="number" className="marks-input" value={mtExam} min="0" max="100"
                            onChange={(e) => handleMarkChange(student.id, 'Midterm_Exam', e.target.value)}
                            onBlur={() => handleBlur(student.id, 'Midterm_Exam')} />
                        </td>
                        <td className="text-center text-text-secondary">{mtConv > 0 ? mtConv.toFixed(2) : '0'}</td>
                        <td className="text-center">
                          <input type="number" className="marks-input" value={mtTest} min="0" max={testMax}
                            onChange={(e) => handleMarkChange(student.id, 'Midterm_Test', e.target.value)}
                            onBlur={() => handleBlur(student.id, 'Midterm_Test')} />
                        </td>
                        <td className="text-center text-primary font-bold">{mtTotal > 0 ? mtTotal : '0'}</td>
                      </>
                    )}

                    {/* Finalterm */}
                    {selectedTerm === 'Finalterm' && (
                      <>
                        <td className="text-center" style={{ borderLeft: '2px solid var(--border-color)' }}>
                          <input type="number" className="marks-input" value={ftExam} min="0" max="100"
                            onChange={(e) => handleMarkChange(student.id, 'Finalterm_Exam', e.target.value)}
                            onBlur={() => handleBlur(student.id, 'Finalterm_Exam')} />
                        </td>
                        <td className="text-center text-text-secondary">{ftConv > 0 ? ftConv.toFixed(2) : '0'}</td>
                        <td className="text-center">
                          <input type="number" className="marks-input" value={ftTest} min="0" max={testMax}
                            onChange={(e) => handleMarkChange(student.id, 'Finalterm_Test', e.target.value)}
                            onBlur={() => handleBlur(student.id, 'Finalterm_Test')} />
                        </td>
                        <td className="text-center text-success font-bold">{ftTotal > 0 ? ftTotal : '0'}</td>
                      </>
                    )}
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center">No students found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SubjectMarks;
