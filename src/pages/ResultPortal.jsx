import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Loader2, BookOpen, Home, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const ResultPortal = () => {
  const queryParams = new URLSearchParams(window.location.search);
  const initialUid = queryParams.get('uid') || '';
  const [uid, setUid] = useState(initialUid);
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultData, setResultData] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState('Midterm'); // 'Midterm', 'Finalterm', 'Combined'

  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 6}, (_, i) => `${currentYear - 1 + i}`);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!uid) return;
    
    setLoading(true);
    setError('');
    setResultData(null);

    try {
      // Call the secure RPC function
      const { data, error } = await supabase.rpc('get_student_report', { 
        p_uid: uid,
        p_academic_year: academicYear
      });

      if (error) throw error;
      if (!data) {
        setError('No student found with this UID for the selected academic year.');
        return;
      }

      setResultData(data);
    } catch (err) {
      console.error(err);
      setError('An error occurred while fetching your result. Please ensure your UID is correct.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-search if initialUid is provided
  useEffect(() => {
    if (initialUid) {
      handleSearch({ preventDefault: () => {} });
    }
  }, []);

  const renderReportCard = () => {
    if (!resultData) return null;

    const { student, class: cls, marks, subjects, class_marks, attendance } = resultData;
    
    const isHigherClass = ['9', '10', '11', '12'].some(grade => cls.name.includes(grade));
    const examConv = isHigherClass ? 80 : 75;
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

    const allSubjects = subjects || [];
    
    // Only include subjects that the student actually has marks for
    const studentSubjects = allSubjects.filter(sub => {
      return marks && marks.some(m => m && m.subject_id === sub.id);
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

    // 1. Calculate Grand Total for THIS student
    let grandTotal = 0;
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
        const markObj = marks ? marks.find(m => m && m.subject_id === sub.id && m.term === fullTerm) : null;
        return markObj && markObj.score !== null ? Number(markObj.score) : 0;
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
    let maxPossibleTotal = 0;

    if (groupsToUse.length > 0) {
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

    // 2. Calculate Grand Totals for ALL students in the class to find Rank
    let rank = '-';
    if (class_marks && class_marks.length > 0) {
      const marksByStudent = {};
      class_marks.forEach(m => {
        if (!m) return;
        if (!marksByStudent[m.student_id]) marksByStudent[m.student_id] = [];
        marksByStudent[m.student_id].push(m);
      });

        const allTotals = [];
        Object.keys(marksByStudent).forEach(sid => {
          let sidTotal = 0;
          const sMarks = marksByStudent[sid];
          const sidSubjectScores = [];
          
          allSubjects.forEach(sub => {
            const getVal = (term) => {
              const fullTerm = `${academicYear}_${term}`;
              const markObj = sMarks.find(m => m.subject_id === sub.id && m.term === fullTerm);
              return markObj && markObj.score !== null ? Number(markObj.score) : 0;
            };

            const mtExam = getVal('Midterm_Exam');
            const mtTest = getVal('Midterm_Test');
            const mtConv = mtExam * (examConv / 100);
            const mtTotal = Math.round(mtConv + mtTest);

            const ftExam = getVal('Finalterm_Exam');
            const ftTest = getVal('Finalterm_Test');
            const ftConv = ftExam * (examConv / 100);
            const ftTotal = Math.round(ftConv + ftTest);

            let subTot = 0;
            if (selectedTerm === 'Midterm') subTot = mtTotal;
            else if (selectedTerm === 'Finalterm') subTot = ftTotal;
            else subTot = mtTotal + ftTotal;

            if (subTot > 0 || Object.keys(sMarks).length > 0) {
                sidSubjectScores.push({ subjectName: sub.name, total: subTot });
            }
          });

          if (groupsToUse.length > 0) {
            const grouped = [];
            const standalone = [];
            const findGroup = (name) => {
              const lowerName = name.toLowerCase();
              return groupsToUse.find(g => g.matchers.some(m => lowerName.includes(m)));
            };

            sidSubjectScores.forEach(score => {
              const group = findGroup(score.subjectName);
              if (group) {
                let existing = grouped.find(g => g.groupName === group.name);
                if (!existing) { existing = { groupName: group.name, items: [] }; grouped.push(existing); }
                existing.items.push(score);
              } else {
                standalone.push(score);
              }
            });

            grouped.forEach(g => {
              const sum = g.items.reduce((acc, curr) => acc + curr.total, 0);
              sidTotal += Math.round(sum / g.items.length);
            });
            standalone.forEach(item => { sidTotal += item.total; });
          } else {
            sidTotal = sidSubjectScores.reduce((acc, curr) => acc + curr.total, 0);
          }
          
          let sidMaxPossible = sidSubjectScores.length * (selectedTerm === 'Combined' ? 200 : 100);
          if (groupsToUse.length > 0) {
             const groupCount = Array.from(new Set(sidSubjectScores.map(s => {
               const group = groupsToUse.find(g => g.matchers.some(m => s.subjectName.toLowerCase().includes(m)));
               return group ? group.name : null;
             }).filter(Boolean))).length;
             const standaloneCount = sidSubjectScores.filter(s => {
               const group = groupsToUse.find(g => g.matchers.some(m => s.subjectName.toLowerCase().includes(m)));
               return !group;
             }).length;
             sidMaxPossible = (groupCount + standaloneCount) * (selectedTerm === 'Combined' ? 200 : 100);
          }
          
          let sidPercentage = sidMaxPossible > 0 ? (sidTotal / sidMaxPossible) * 100 : 0;
          allTotals.push(isISCClass ? sidPercentage : sidTotal);
        });
        
        allTotals.sort((a, b) => b - a);
        const myCompareValue = isISCClass ? (maxPossibleTotal > 0 ? (grandTotal / maxPossibleTotal) * 100 : 0) : grandTotal;
        rank = allTotals.findIndex(v => Math.abs(v - myCompareValue) < 0.01) + 1;
    }

    const percentage = maxPossibleTotal > 0 ? ((grandTotal / maxPossibleTotal) * 100).toFixed(1) : 0;

    const getTermLabel = () => {
      if (selectedTerm === 'Midterm') return 'MID-TERM';
      if (selectedTerm === 'Finalterm') return 'FINAL-TERM';
      return 'COMBINED';
    };

    const getOutOFAmount = () => selectedTerm === 'Combined' ? 200 : 100;

    // Calculate Attendance
    const stuAtt = attendance || [];
    const totalWorkingDays = stuAtt.length;
    const daysPresent = stuAtt.filter(a => a.status === 'Present' || a.status === 'Late').length;
    const daysHalfDay = stuAtt.filter(a => a.status === 'Half Day').length;
    const effectivePresent = daysPresent + (daysHalfDay * 0.5);
    const attendancePercentage = totalWorkingDays > 0 ? ((effectivePresent / totalWorkingDays) * 100).toFixed(1) : '-';

    return (
      <div className="report-card-slip" style={{
        width: '100%',
        maxWidth: '800px',
        margin: '2rem auto',
        padding: '1rem',
        fontFamily: 'Arial, sans-serif',
        background: '#fff',
        color: '#000',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black', fontSize: '14px' }}>
          <tbody>
            {/* Header Row */}
            <tr>
              <td colSpan="2" style={{ padding: '10px 12px', border: '1px solid black' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span><span style={{ fontWeight: 'bold' }}>Student Name:</span> <span>{student.name}</span></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><span style={{ fontWeight: 'bold' }}>Class:</span> <span>{cls.name}</span></span>
                  <span><span style={{ fontWeight: 'bold' }}>Section:</span> <span>{cls.section}</span></span>
                  <span><span style={{ fontWeight: 'bold' }}>Roll No:</span> <span>{student.roll_no}</span></span>
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan="2" style={{ padding: '15px 12px', border: '1px solid black', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1em', textTransform: 'uppercase' }}>
                {getTermLabel()} PROGRESS REPORT CARD - {academicYear}
              </td>
            </tr>
            
            {/* Column Headers */}
            <tr>
              <td style={{ padding: '8px 12px', border: '1px solid black', fontWeight: 'bold' }}>Subjects</td>
              <td style={{ padding: '8px 12px', border: '1px solid black', fontWeight: 'bold', textAlign: 'center', width: '150px' }}>Marks out of {getOutOFAmount()}</td>
            </tr>

            {/* Subjects Rows */}
            {finalSubjectRows.map(score => {
              if (!score.isGroupStart && groupsToUse.length > 0) return null; // We only render one row per group/standalone in this simplified layout
              return (
                <tr key={score.subjectId}>
                  <td style={{ padding: '8px 12px', border: '1px solid black' }}>
                    {score.isStandalone ? score.subjectName : (groupsToUse.find(g => g.matchers.some(m => score.subjectName.toLowerCase().includes(m)))?.name || score.subjectName)}
                  </td>
                  <td style={{ padding: '8px 12px', border: '1px solid black', textAlign: 'center' }}>
                    {score.groupTotal}
                  </td>
                </tr>
              );
            })}

            {/* Total Row */}
            <tr>
              <td style={{ padding: '8px 12px', border: '1px solid black', fontWeight: 'bold' }}>TOTAL</td>
              <td style={{ padding: '8px 12px', border: '1px solid black', textAlign: 'center', fontWeight: 'bold' }}>{grandTotal}</td>
            </tr>

            {/* Footer Details */}
            <tr>
              <td colSpan="2" style={{ padding: '15px 12px', border: '1px solid black', lineHeight: '1.8' }}>
                <div>RANK IN CLASS: <span>{rank}</span></div>
                <div>PERCENTAGE: <span>{percentage}%</span></div>
                <div>ATTENDANCE: <span>{totalWorkingDays > 0 ? `${effectivePresent} / ${totalWorkingDays} Days (${attendancePercentage}%)` : 'N/A'}</span></div>
                <div>CONDUCT: <span></span></div>
                <div>PERSONALITY & NEATNESS: <span></span></div>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div style={{ marginTop: '1rem', textAlign: 'center', display: 'flex', gap: '1rem', justifyContent: 'center' }} className="no-print">
           <button className="btn" style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => { setUid(''); setResultData(null); window.history.replaceState({}, document.title, window.location.pathname); }}>
             <RefreshCw size={18} /> Search Another
           </button>
           <button className="btn btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)' }}>
      {/* If result is NOT loaded yet, show the hero-search view */}
      {!resultData && (
        <div className="hero-section" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'linear-gradient(to bottom right, #4338ca, #312e81)' }}>
          <div className="hero-particles">
            <motion.div animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 4 }} className="hero-orb-1" />
            <motion.div animate={{ y: [0, 30, 0], opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 5, delay: 1 }} className="hero-orb-2" />
          </div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '500px' }}>
            <div className="bento-card" style={{ padding: '3rem 2.5rem', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
              
              <div style={{ textAlign: 'center', marginBottom: '2rem', position: 'relative' }}>
                <Link to="/" style={{ position: 'absolute', top: 0, right: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                   <Home size={20} />
                </Link>
                
                <img src="/logo.png" alt="School Logo" style={{ width: '100px', height: '100px', objectFit: 'contain', margin: '0 auto 1rem', display: 'block' }} />
                <h1 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem', fontSize: '1.8rem', fontWeight: 'bold' }}>Result Portal</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Enter your 6-digit PIN to view your academic progress.</p>
              </div>

              <form onSubmit={handleSearch} className="flex flex-col gap-4">
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>Academic Year</label>
                  <select 
                    className="input-field w-full" 
                    style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>Term</label>
                  <select 
                    className="input-field w-full" 
                    style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}
                    value={selectedTerm}
                    onChange={(e) => {
                      setSelectedTerm(e.target.value);
                      setResultData(null);
                    }}
                  >
                    <option value="Midterm">Mid-Term Report</option>
                    <option value="Finalterm">Final-Term Report</option>
                    <option value="Combined">Combined (Annual)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>Student UID (6-Digit PIN)</label>
                  <div className="relative">
                    <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="e.g. 849201"
                      className="input-field w-full"
                      style={{ paddingLeft: '40px', fontSize: '1.2rem', letterSpacing: '2px', background: '#f9fafb', border: '1px solid #e5e7eb' }}
                      value={uid}
                      onChange={(e) => setUid(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      required
                    />
                  </div>
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: '#b91c1c', padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                    {error}
                  </motion.div>
                )}

                <button type="submit" className="btn-hero-primary" style={{ width: '100%', marginTop: '1rem', background: '#4f46e5', color: 'white', border: 'none' }} disabled={loading}>
                  {loading ? <Loader2 className="animate-spin mx-auto" /> : 'View Report Card'}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* If result is loaded, show the report card in a clean printable container */}
      {resultData && (
         <div style={{ padding: '2rem 1rem' }}>
           <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }} className="no-print">
             <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 600 }}>
               <Home size={20} /> Campus Home
             </Link>
             <button className="btn" style={{ background: 'white', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '0.5rem' }} onClick={() => { setUid(''); setResultData(null); window.history.replaceState({}, document.title, window.location.pathname); }}>
               <RefreshCw size={18} /> Search Another
             </button>
           </div>
           {renderReportCard()}
         </div>
      )}
    </div>
  );
};

export default ResultPortal;
