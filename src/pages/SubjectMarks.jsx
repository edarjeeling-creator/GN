import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ArrowLeft, Save, AlertCircle, CheckCircle2, Upload, Search, ChevronDown, ChevronUp, User } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { useReactTable, getCoreRowModel, flexRender, getSortedRowModel, getFilteredRowModel } from '@tanstack/react-table';

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
  const classStudents = useMemo(() => 
    students.filter(s => s.class_id === classId || s.classId === classId).sort((a, b) => a.roll_no - b.roll_no),
  [students, classId]);
  
  const { examConv, testMax } = getConversionConstants(cls?.name);

  const [localMarks, setLocalMarks] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, saved, error
  const [isLocked, setIsLocked] = useState(false);
  
  const filteredStudents = useMemo(() => {
    return classStudents.filter(student => {
      const subName = subject?.name?.toLowerCase() || '';
      if (subName.includes('2nd') || subName.includes('second')) return student.second_language ? subName.includes(student.second_language.toLowerCase()) : true;
      if (subName.includes('3rd') || subName.includes('third')) return student.third_language ? subName.includes(student.third_language.toLowerCase()) : true;
      if (subName.includes('elective') || subName.includes('evs/math') || subName.includes('maths/evs') || subName.includes('math/evs')) return student.elective_subject ? subName.includes(student.elective_subject.toLowerCase()) : true;
      if (subName.includes('6th') || subName.includes('sixth')) return student.sixth_subject ? subName.includes(student.sixth_subject.toLowerCase()) : true;
      return true;
    });
  }, [classStudents, subject]);

  const [globalFilter, setGlobalFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Midterm');
  const [sorting, setSorting] = useState([]);
  const fileInputRef = useRef(null);

  const isSecondLanguage = subject?.name.toLowerCase().includes('2nd language') || subject?.name.toLowerCase().includes('second language');
  const isThirdLanguage = subject?.name.toLowerCase().includes('3rd language') || subject?.name.toLowerCase().includes('third language');
  const isElective = subject?.name.toLowerCase().includes('elective') || subject?.name.toLowerCase().includes('evs/math') || subject?.name.toLowerCase().includes('maths/evs') || subject?.name.toLowerCase().includes('math/evs');
  const isSixthSubject = subject?.name.toLowerCase().includes('6th') || subject?.name.toLowerCase().includes('sixth');
  const hasLanguageOptions = isSecondLanguage || isThirdLanguage || isElective || isSixthSubject;

  const uniqueLanguages = useMemo(() => [...new Set(classStudents.map(s => {
    if (isSecondLanguage) return s.second_language;
    if (isThirdLanguage) return s.third_language;
    if (isElective) return s.elective_subject;
    if (isSixthSubject) return s.sixth_subject;
    return null;
  }).filter(Boolean))], [classStudents, isSecondLanguage, isThirdLanguage, isElective, isSixthSubject]);

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
  }, [classStudents.map(s => s.id).join(','), marks, subjectId, academicYear]);

  useEffect(() => {
    const checkLockStatus = async () => {
      const fullTerm = `${academicYear}_${selectedTerm}_Exam`;
      const { data } = await supabase
        .from('marks_status')
        .select('status')
        .eq('class_id', classId)
        .eq('term', fullTerm)
        .single();
      
      setIsLocked(data?.status === 'Locked' || data?.status === 'Published');
    };
    checkLockStatus();
  }, [classId, selectedTerm, academicYear]);

  const handleMarkChange = (studentId, term, value) => {
    let maxMark = 100;
    if (term.includes('Test')) maxMark = testMax;
    if (value !== '' && (isNaN(value) || value < 0 || value > maxMark)) return; 
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
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        let newLocalMarks = { ...localMarks };
        let changesMade = false;
        data.forEach(row => {
          const rollNo = row['Roll No'] || row['Roll'] || row['roll_no'];
          if (!rollNo) return;
          const student = classStudents.find(s => Number(s.roll_no) === Number(rollNo));
          if (!student) return;
          const setMarkIfPresent = (colName, term) => {
            const val = row[colName];
            if (val !== undefined && val !== null) {
              const key = `${student.id}_${subjectId}_${academicYear}_${term}`;
              newLocalMarks[key] = val === '' ? '' : Number(val);
              changesMade = true;
            }
          };
          setMarkIfPresent('Mid Exam', 'Midterm_Exam');
          setMarkIfPresent('Mid Test', 'Midterm_Test');
          setMarkIfPresent('Final Exam', 'Finalterm_Exam');
          setMarkIfPresent('Final Test', 'Finalterm_Test');
        });
        if (changesMade) { setLocalMarks(newLocalMarks); setSaveStatus('pending'); }
        alert('Excel imported successfully! Please review the numbers and click "Save All".');
      } catch (err) { alert('Error parsing Excel file. Make sure it has columns: Roll No, Mid Exam, Mid Test, Final Exam, Final Test'); }
      finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsBinaryString(file);
  };

  const visibleStudents = useMemo(() => {
    return filteredStudents.filter(s => {
      if (hasLanguageOptions && languageFilter) {
        let studentLang = isSecondLanguage ? s.second_language : isThirdLanguage ? s.third_language : isElective ? s.elective_subject : isSixthSubject ? s.sixth_subject : null;
        if (!studentLang || !studentLang.toLowerCase().includes(languageFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [filteredStudents, languageFilter, hasLanguageOptions, isSecondLanguage, isThirdLanguage, isElective, isSixthSubject]);

  const columns = useMemo(() => {
    const isMid = selectedTerm === 'Midterm';
    return [
      { accessorKey: 'roll_no', header: 'Roll No', cell: info => <span className="font-bold text-slate-700">{info.getValue()}</span> },
      {
        accessorKey: 'name',
        header: 'Student Name',
        cell: info => {
          const student = info.row.original;
          return (
            <div className="flex items-center gap-4 py-2">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-200 shrink-0 bg-slate-50 flex items-center justify-center">
                {student.picture_url ? <img src={student.picture_url} className="w-full h-full object-cover" /> : <User size={20} className="text-slate-400" />}
              </div>
              <span className="font-semibold text-slate-800">{student.name}</span>
            </div>
          );
        },
      },
      {
        id: 'exam',
        header: 'Exam (100)',
        cell: ({ row, table }) => {
          const { localMarks, handleMarkChange, handleBlur, subjectId, academicYear, isLocked } = table.options.meta;
          const termKey = isMid ? 'Midterm_Exam' : 'Finalterm_Exam';
          const val = localMarks[`${row.original.id}_${subjectId}_${academicYear}_${termKey}`];
          return <Input type="number" className="w-20 text-center font-semibold" value={val !== undefined ? val : ''} min="0" max="100" onChange={e => handleMarkChange(row.original.id, termKey, e.target.value)} onBlur={() => handleBlur(row.original.id, termKey)} disabled={isLocked} />;
        }
      },
      {
        id: 'conv',
        header: `Conv (${examConv})`,
        cell: ({ row, table }) => {
          const { localMarks, subjectId, academicYear, calculateConverted } = table.options.meta;
          const termKey = isMid ? 'Midterm_Exam' : 'Finalterm_Exam';
          const val = localMarks[`${row.original.id}_${subjectId}_${academicYear}_${termKey}`];
          const conv = calculateConverted(val);
          return <span className="text-slate-500 font-medium">{conv > 0 ? conv.toFixed(2) : '0'}</span>;
        }
      },
      {
        id: 'test',
        header: `Test (${testMax})`,
        cell: ({ row, table }) => {
          const { localMarks, handleMarkChange, handleBlur, subjectId, academicYear, isLocked } = table.options.meta;
          const termKey = isMid ? 'Midterm_Test' : 'Finalterm_Test';
          const val = localMarks[`${row.original.id}_${subjectId}_${academicYear}_${termKey}`];
          return <Input type="number" className="w-20 text-center font-semibold" value={val !== undefined ? val : ''} min="0" max={testMax} onChange={e => handleMarkChange(row.original.id, termKey, e.target.value)} onBlur={() => handleBlur(row.original.id, termKey)} disabled={isLocked} />;
        }
      },
      {
        id: 'total',
        header: 'Total (100)',
        cell: ({ row, table }) => {
          const { localMarks, subjectId, academicYear, calculateConverted } = table.options.meta;
          const examKey = isMid ? 'Midterm_Exam' : 'Finalterm_Exam';
          const testKey = isMid ? 'Midterm_Test' : 'Finalterm_Test';
          const examVal = localMarks[`${row.original.id}_${subjectId}_${academicYear}_${examKey}`];
          const testVal = localMarks[`${row.original.id}_${subjectId}_${academicYear}_${testKey}`];
          const conv = calculateConverted(examVal);
          const total = Math.round(conv + (testVal === '' || testVal === undefined ? 0 : Number(testVal)));
          return <span className={`font-bold text-lg ${isMid ? 'text-brand-600' : 'text-emerald-600'}`}>{total > 0 ? total : '0'}</span>;
        }
      }
    ];
  }, [selectedTerm, examConv, testMax]);

  const table = useReactTable({
    data: visibleStudents,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    autoResetSorting: false,
    autoResetGlobalFilter: false,
    meta: {
      localMarks,
      handleMarkChange,
      handleBlur,
      subjectId,
      academicYear,
      calculateConverted,
      isLocked
    }
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <Button variant="outline" size="sm" onClick={() => navigate('/classes')} className="mb-4 text-slate-500 hover:text-slate-800">
            <ArrowLeft size={16} className="mr-2" /> Back to Classes
          </Button>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Marks Entry: {subject?.name}</h1>
          <p className="text-slate-500 mt-1">{cls?.name} {cls?.section} <span className="inline-block mx-2 text-slate-300">|</span> Exam translates to {examConv}, Test is out of {testMax}</p>
          {isLocked && (
            <div className="mt-2 text-orange-600 bg-orange-50 px-3 py-1.5 rounded-md inline-flex items-center gap-2 font-semibold">
              <AlertCircle size={16} /> Results for this term are Locked. Editing is disabled.
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {saveStatus === 'pending' && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-amber-500 flex items-center gap-1.5 text-sm font-semibold bg-amber-50 px-3 py-1.5 rounded-full"><AlertCircle size={16}/> Unsaved changes</motion.span>}
            {saveStatus === 'saving' && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-slate-500 text-sm font-semibold flex items-center gap-2"><div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"/> Saving...</motion.span>}
            {saveStatus === 'saved' && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-emerald-500 flex items-center gap-1.5 text-sm font-semibold bg-emerald-50 px-3 py-1.5 rounded-full"><CheckCircle2 size={16}/> Saved</motion.span>}
          </AnimatePresence>
          
          <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" disabled={isLocked} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="shrink-0 bg-white shadow-sm" disabled={isLocked}>
            <Upload size={18} className="mr-2" /> Import Excel
          </Button>
          <Button onClick={() => {
            Object.entries(localMarks).forEach(([key, val]) => {
              if (val !== marks[key]) {
                const parts = key.split('_');
                const studentId = parts[0];
                const subjId = parts[1];
                const term = parts.slice(3).join('_');
                updateMark(studentId, subjId, term, val === '' ? '' : Number(val));
              }
            });
            setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000);
          }} className="shrink-0 shadow-md" disabled={isLocked}>
            <Save size={18} className="mr-2" /> Save All
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input value={globalFilter ?? ''} onChange={e => setGlobalFilter(e.target.value)} placeholder="Search student..." className="pl-10 h-10 w-full bg-slate-50" />
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            {hasLanguageOptions && (
              <select className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 bg-white" value={languageFilter} onChange={e => setLanguageFilter(e.target.value)}>
                <option value="">All Languages</option>
                {uniqueLanguages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
              </select>
            )}
            <select className="h-10 px-4 rounded-lg border border-slate-300 text-sm font-bold bg-slate-800 text-white focus:ring-2 focus:ring-slate-500" value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
              <option value="Midterm">Mid-Term</option>
              <option value="Finalterm">Final-Term</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className={`p-4 font-semibold text-slate-600 text-sm whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors ${['exam', 'conv', 'test', 'total'].includes(header.id) ? 'text-center' : ''}`} onClick={header.column.getToggleSortingHandler()}>
                      <div className={`flex items-center gap-2 ${['exam', 'conv', 'test', 'total'].includes(header.id) ? 'justify-center' : ''}`}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: <ChevronUp size={14} />, desc: <ChevronDown size={14} /> }[header.column.getIsSorted()] ?? null}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className={`p-4 align-middle ${['exam', 'conv', 'test', 'total'].includes(cell.column.id) ? 'text-center' : ''}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center text-slate-500">No matching students found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
};

export default SubjectMarks;
