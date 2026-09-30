import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Check, X, Clock, AlertTriangle, Save, Loader2, Calendar, User, Search, ChevronDown, ChevronUp, Camera, FileUp, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { useReactTable, getCoreRowModel, flexRender, getSortedRowModel, getFilteredRowModel } from '@tanstack/react-table';
import { absenteeNotificationService } from '../services/AbsenteeNotificationService';
import AbsenteeNotificationModal from '../components/AbsenteeNotificationModal';
import AttendanceCameraModal from '../components/AttendanceCameraModal';
import AttendanceAIKeyModal from '../components/AttendanceAIKeyModal';
import { AttendanceAIService } from '../services/AttendanceAIService';
import { formatStudentDisplayName } from '../utils/studentUtils';

const Attendance = () => {
  const { classes, students, academicYear } = useData();
  const { profile } = useAuth();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLocked, setIsLocked] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([]);

  // Absentee Notification Modal State
  const [absenteeModalData, setAbsenteeModalData] = useState(null);
  const [showAbsenteeModal, setShowAbsenteeModal] = useState(false);

  // AI Camera & Scan Modal State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [keyModalError, setKeyModalError] = useState('');
  const [pendingAiImageFile, setPendingAiImageFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const fileInputRef = useRef(null);

  const classStudents = useMemo(() => {
    return students
      .filter(s => s.class_id === selectedClassId)
      .sort((a, b) => a.roll_no - b.roll_no);
  }, [students, selectedClassId]);

  useEffect(() => {
    if (!selectedClassId || !selectedDate) {
      setAttendanceData({});
      return;
    }
    const fetchAttendanceAndSettings = async () => {
      setLoading(true);
      const { data: settingsData } = await supabase.from('school_settings').select('*').eq('setting_key', 'attendance_lock_time_default').single();
      if (settingsData) {
        const lockHour = 23, lockMinute = 59;
        const now = new Date(), lockDate = new Date();
        lockDate.setHours(lockHour, lockMinute, 0);
        const selectedDateObj = new Date(selectedDate); selectedDateObj.setHours(0,0,0,0);
        const todayObj = new Date(); todayObj.setHours(0,0,0,0);
        if (selectedDateObj < todayObj) setIsLocked(true);
        else if (selectedDateObj.getTime() === todayObj.getTime() && now > lockDate) setIsLocked(true);
        else setIsLocked(false);
      }

      const { data, error } = await supabase.from('attendance').select('*').eq('class_id', selectedClassId).eq('date', selectedDate);
      if (!error && data) {
        const currentData = {};
        data.forEach(record => currentData[record.student_id] = { id: record.id, status: record.status, remarks: record.remarks || '' });
        classStudents.forEach(student => { if (!currentData[student.id]) currentData[student.id] = { id: null, status: '', remarks: '' }; });
        setAttendanceData(currentData);
      }
      setLoading(false);
    };
    fetchAttendanceAndSettings();
  }, [selectedClassId, selectedDate, students, classStudents]);

  const handleStatusChange = (studentId, status) => {
    setAttendanceData(prev => ({ ...prev, [studentId]: { ...prev[studentId], status } }));
  };

  const handleRemarksChange = (studentId, remarks) => {
    setAttendanceData(prev => ({ ...prev, [studentId]: { ...prev[studentId], remarks } }));
  };

  const markAllPresent = () => {
    if (window.confirm(`Are you sure you want to mark all ${classStudents.length} students as Present?`)) {
      const updatedData = { ...attendanceData };
      classStudents.forEach(student => {
        if (!updatedData[student.id] || !updatedData[student.id].status) updatedData[student.id] = { ...updatedData[student.id], status: 'Present' };
      });
      setAttendanceData(updatedData);
    }
  };

  const processImageFile = async (rawFile) => {
    if (!rawFile) return;

    if (!rawFile.type.startsWith('image/')) {
      alert('Please upload a valid image file.');
      return;
    }

    setIsAnalyzing(true);
    setMessage({ text: 'AI is analyzing attendance register photo...', type: 'warning' });
    
    try {
      // Auto-compress high-res camera captures (e.g. 12-48MP photos) to stay under 5MB while preserving text sharpness
      let file = rawFile;
      if (rawFile.size > 3 * 1024 * 1024) {
        file = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const MAX_DIM = 2400;
              let { width, height } = img;
              if (width > MAX_DIM || height > MAX_DIM) {
                if (width > height) {
                  height = Math.round((height * MAX_DIM) / width);
                  width = MAX_DIM;
                } else {
                  width = Math.round((width * MAX_DIM) / height);
                  height = MAX_DIM;
                }
              }
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);
              canvas.toBlob((blob) => {
                if (blob) {
                  resolve(new File([blob], rawFile.name || 'attendance.jpg', { type: 'image/jpeg' }));
                } else {
                  resolve(rawFile);
                }
              }, 'image/jpeg', 0.88);
            };
            img.onerror = () => resolve(rawFile);
            img.src = e.target.result;
          };
          reader.onerror = () => resolve(rawFile);
          reader.readAsDataURL(rawFile);
        });
      }

      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB.');
        setIsAnalyzing(false);
        setMessage({ text: '', type: '' });
        return;
      }

      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const mimeType = file.type || 'image/jpeg';

      const data = await AttendanceAIService.analyzeRegister({
        base64Image: base64Data,
        mimeType,
        classId: selectedClassId,
        selectedDate
      });

      if (!data) throw new Error("No data returned from AI");

      if (data.month_year_match === false) {
        throw new Error("The uploaded register appears to be from a different month or year than the selected date.");
      }

      if (data.date_column_found === false) {
        throw new Error("Could not confidently locate the selected date column. Please verify the register image.");
      }

      if (!data.results) {
        throw new Error("No records returned from AI");
      }

      // Optional: show a warning if confidence is low, but still allow review
      if (data.date_column_confidence && data.date_column_confidence < 0.6) {
        setMessage({ text: 'Warning: The AI is not highly confident it found the correct date column. Please review carefully.', type: 'warning' });
      } else {
        setMessage({ text: `Successfully extracted attendance for ${data.results.length} students. Please review below.`, type: 'success' });
      }

      const matchedResults = data.results.map((aiRecord, index) => {
        let matchedStudent = null;
        let matchStatus = 'UNMATCHED';

        if (aiRecord.roll_no != null) {
          matchedStudent = classStudents.find(s => parseInt(s.roll_no) === parseInt(aiRecord.roll_no));
        }

        // 2. Exact/Normalized name match
        if (!matchedStudent && aiRecord.name) {
          const normalizedName = aiRecord.name.toLowerCase().replace(/\s+/g, ' ').trim();
          matchedStudent = classStudents.find(s => s.name.toLowerCase().replace(/\s+/g, ' ').trim() === normalizedName);
        }

        // 3. If no exact match, flag as ambiguous. Do not guess with substring.
        if (!matchedStudent && aiRecord.name) {
           matchStatus = 'AMBIGUOUS';
        }

        if (matchedStudent && matchStatus !== 'AMBIGUOUS') {
          matchStatus = 'MATCHED';
        }

        return {
          ...aiRecord,
          key: `ai_row_${index}`,
          matchStatus,
          studentId: matchedStudent?.id || null,
          resolvedStatus: (matchStatus === 'MATCHED' && aiRecord.status && aiRecord.confidence > 0.6) ? aiRecord.status : ''
        };
      });

      setAiResults(matchedResults);
    } catch (err) {
      console.error('AI Analysis failed:', err);
      if (err.needsApiKey) {
        setPendingAiImageFile(rawFile);
        setKeyModalError(err.message);
        setIsKeyModalOpen(true);
        setMessage({ text: '', type: '' });
      } else {
        setMessage({ text: err.message || 'Failed to analyze image.', type: 'danger' });
      }
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const updateAiResultStatus = (key, status) => {
    setAiResults(prev => prev.map(res => res.key === key ? { ...res, resolvedStatus: status } : res));
  };
  
  const updateAiResultStudent = (key, studentId) => {
    setAiResults(prev => prev.map(res => res.key === key ? { 
      ...res, 
      studentId, 
      matchStatus: 'MATCHED' 
    } : res));
  };

  const confirmAiImport = () => {
    const updatedData = { ...attendanceData };
    aiResults.forEach(res => {
      if (res.studentId && res.resolvedStatus) {
         updatedData[res.studentId] = { 
           ...updatedData[res.studentId], 
           status: res.resolvedStatus 
         };
      }
    });
    setAttendanceData(updatedData);
    setAiResults(null);
  };

  const cancelAiImport = () => {
    setAiResults(null);
  };

  const triggerSaveFlow = () => {
    if (!selectedClassId || !selectedDate) {
      setMessage({ text: 'Please select a class and date first.', type: 'danger' });
      return;
    }
    if (isLocked) {
      if (profile?.role === 'admin') {
        setShowOverrideModal(true);
      } else {
        setMessage({ text: 'Attendance window is locked for this date.', type: 'danger' });
      }
      return;
    }
    executeSave();
  };

  const executeSave = async (overrideData = null) => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    
    const validStatuses = ['Present', 'Absent', 'Late', 'Half Day', 'Leave'];

    const recordsToUpsert = classStudents.map(student => {
      let rawStatus = attendanceData[student.id]?.status || 'Present';
      let remarks = attendanceData[student.id]?.remarks || null;

      // Normalize 'Medical Leave' to 'Leave' with remark to satisfy DB check constraint
      if (rawStatus === 'Medical Leave') {
        rawStatus = 'Leave';
        remarks = remarks ? `Medical Leave: ${remarks}` : 'Medical Leave';
      }

      const status = validStatuses.includes(rawStatus) ? rawStatus : 'Present';

      return {
        student_id: student.id,
        class_id: selectedClassId,
        date: selectedDate,
        academic_year: academicYear || '2026',
        status,
        remarks: remarks || null
      };
    }).filter(record => record.status !== '');

    if (recordsToUpsert.length === 0) {
      setMessage({ text: 'Please mark attendance before saving.', type: 'danger' });
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase.from('attendance').upsert(recordsToUpsert, { onConflict: 'student_id,date' });
      if (error) throw error;

      const absentRecords = recordsToUpsert.filter(r => r.status === 'Absent');
      const presentRecords = recordsToUpsert.filter(r => r.status !== 'Absent');
      const selectedClass = classes.find(c => c.id === selectedClassId);
      const className = selectedClass ? `${selectedClass.name} ${selectedClass.section}` : '';

      if (presentRecords.length > 0 && profile?.id) {
        try {
          await supabase.from('student_notifications').update({ 
            is_invalid: true, 
            invalidated_at: new Date().toISOString(), 
            invalidated_by: profile.id 
          })
          .eq('type', 'absence_alert')
          .eq('attendance_date', selectedDate)
          .in('student_id', presentRecords.map(r => r.student_id));
        } catch (e) {
          // ignore if table does not exist
        }
      }

      if (absentRecords.length > 0) {
        const enrichedAbsentStudents = absentRecords.map(record => {
          const studentInfo = classStudents.find(s => s.id === record.student_id) || {};
          return {
            ...studentInfo,
            ...record
          };
        });

        // Trigger comprehensive multi-channel notifications (Principal, Parents, Push)
        const dispatchResult = await absenteeNotificationService.notifyAbsentees({
          absentStudents: enrichedAbsentStudents,
          className,
          classId: selectedClassId,
          date: selectedDate,
          teacherName: profile?.name || 'Class Teacher',
          teacherId: profile?.id,
          schoolId: profile?.school_id
        });

        setAbsenteeModalData(dispatchResult);
        setShowAbsenteeModal(true);

        setMessage({ 
          text: `Attendance saved! ${absentRecords.length} absence notification(s) dispatched.`, 
          type: 'success' 
        });
      } else {
        setMessage({ text: 'Attendance saved successfully! (100% Present)', type: 'success' });
      }

      if (overrideData && overrideReason) {
        const { data } = await supabase.from('attendance').select('id').eq('class_id', selectedClassId).eq('date', selectedDate).limit(1);
        await supabase.from('attendance_overrides').insert({ 
          attendance_id: data ? data[0]?.id : recordsToUpsert[0].id, 
          overridden_by: profile?.id, 
          new_status: 'Batch Override', 
          reason: overrideReason 
        });
        setShowOverrideModal(false); 
        setOverrideReason('');
      }
    } catch (err) {
      console.error('Attendance save error:', err);
      const errDetail = err?.message || err?.error_description || 'Failed to save attendance.';
      setMessage({ text: `Failed to save: ${errDetail}`, type: 'danger' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Present': return 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600';
      case 'Absent': return 'bg-red-500 text-white border-red-500 hover:bg-red-600';
      case 'Late': return 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600';
      case 'Half Day': return 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600';
      case 'Leave': return 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600';
      case 'Medical Leave': return 'bg-purple-500 text-white border-purple-500 hover:bg-purple-600';
      default: return 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
    }
  };

  const columns = useMemo(() => [
    {
      accessorKey: 'roll_no',
      header: 'Roll No',
      cell: info => <span className="font-bold text-slate-700">{info.getValue()}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Student Name',
      cell: info => {
        const student = info.row.original;
        return (
          <div className="flex items-center gap-4 py-2">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-200 shrink-0 bg-slate-50 flex items-center justify-center">
              {student.picture_url ? <img src={student.picture_url} alt={student.name} className="w-full h-full object-cover" /> : <User size={20} className="text-slate-400" />}
            </div>
            <span className="font-semibold text-slate-800">{formatStudentDisplayName(student.name)}</span>
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Attendance Status',
      cell: ({ row }) => {
        const student = row.original;
        const currentStatus = attendanceData[student.id]?.status || '';
        const statuses = ['Present', 'Absent', 'Late', 'Leave', 'Medical Leave'];
        return (
          <div className="flex flex-wrap gap-2">
            {statuses.map(status => {
              const isSelected = currentStatus === status;
              const disabled = isLocked && profile?.role === 'teacher';
              return (
                <button
                  key={status}
                  disabled={disabled}
                  onClick={() => handleStatusChange(student.id, status)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all flex items-center gap-1.5
                    ${isSelected ? getStatusColor(status) : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {status === 'Present' && <Check size={14} />}
                  {(status === 'Absent' || status === 'Leave' || status === 'Medical Leave') && <X size={14} />}
                  {status === 'Late' && <Clock size={14} />}
                  {status}
                </button>
              );
            })}
          </div>
        );
      }
    },
    {
      id: 'remarks',
      header: 'Remarks',
      cell: ({ row }) => {
        const student = row.original;
        return (
          <Input
            value={attendanceData[student.id]?.remarks || ''}
            onChange={e => handleRemarksChange(student.id, e.target.value)}
            placeholder="Optional remarks..."
            className="w-full max-w-[200px] h-9 text-sm"
            disabled={isLocked && profile?.role === 'teacher'}
          />
        );
      }
    }
  ], [attendanceData, isLocked, profile]);

  const table = useReactTable({
    data: classStudents,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Calendar className="text-brand-600 dark:text-brand-400" size={32} /> Daily Attendance
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Mark and manage daily attendance for your classes.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setKeyModalError('');
            setIsKeyModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 hover:border-amber-400 dark:hover:border-amber-500/50 transition-colors shadow-sm cursor-pointer"
          title="Configure Google Gemini AI Key"
        >
          <Key size={14} className="text-amber-500" />
          <span>AI Setup</span>
        </button>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Select Class</label>
              <select className="input-field w-full h-11 bg-white dark:bg-slate-800 dark:text-white" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                <option value="">-- Choose Class --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Date</label>
              <Input type="date" className="w-full h-11" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full">
              <Button 
                onClick={markAllPresent} 
                disabled={!selectedClassId || classStudents.length === 0 || (isLocked && profile?.role === 'teacher')} 
                className="w-full h-10 sm:h-11 shadow-sm px-1 sm:px-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap"
                title="Mark all students present"
              >
                <Check size={15} className="shrink-0 mr-1" />
                <span>Mark All</span>
              </Button>
              <Button 
                onClick={() => {
                  if (!selectedClassId) {
                    setMessage({ text: 'Please select a class first.', type: 'danger' });
                    return;
                  }
                  setIsCameraModalOpen(true);
                }} 
                disabled={!selectedClassId || classStudents.length === 0 || isAnalyzing || (isLocked && profile?.role === 'teacher')} 
                variant="secondary"
                className="w-full h-10 sm:h-11 shadow-sm px-1 sm:px-2.5 border-brand-200 dark:border-brand-700 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold whitespace-nowrap"
                title="Open active camera to scan attendance register"
              >
                {isAnalyzing ? <Loader2 size={15} className="animate-spin shrink-0 mr-1" /> : <Camera size={15} className="shrink-0 mr-1" />}
                <span>Import AI</span>
              </Button>
              <Button 
                onClick={triggerSaveFlow} 
                disabled={saving || !selectedClassId || classStudents.length === 0 || (isLocked && profile?.role === 'teacher')} 
                className="w-full h-10 sm:h-11 shadow-md px-1 sm:px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold whitespace-nowrap"
                title="Save attendance"
              >
                {saving ? <Loader2 className="animate-spin shrink-0 mr-1" size={15} /> : <Save size={15} className="shrink-0 mr-1" />}
                <span>{saving ? 'Saving...' : 'Save'}</span>
                <span className="hidden xl:inline">&nbsp;Attendance</span>
              </Button>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                className="hidden" 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {isLocked && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-3">
              <Clock size={20} className="text-amber-600 shrink-0" />
              <p className="text-sm"><strong>Attendance Locked:</strong> The daily attendance window has closed. {profile?.role === 'admin' ? 'As an admin, you can override.' : 'Contact the Principal to make changes.'}</p>
            </div>
          </motion.div>
        )}
        
        {message.text && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`p-4 rounded-xl text-white font-medium flex items-center justify-between gap-3 flex-wrap ${message.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? <Check size={20}/> : <AlertTriangle size={20}/>}
              <span>{message.text}</span>
            </div>
            {message.type !== 'success' && (
              <button
                type="button"
                onClick={() => {
                  setKeyModalError(message.text);
                  setIsKeyModalOpen(true);
                }}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <Key size={14} />
                <span>Configure AI Key</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {selectedClassId ? (
        loading ? (
          <div className="flex justify-center items-center p-16 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="animate-spin text-brand-500" size={40} />
          </div>
        ) : classStudents.length === 0 ? (
          <Card className="text-center p-12 bg-slate-50 border-dashed border-slate-300">
            <User size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">No students found</h3>
            <p className="text-slate-500">This class currently has no enrolled students.</p>
          </Card>
        ) : aiResults ? (
          <Card className="overflow-hidden flex flex-col shadow-sm border-brand-300 bg-brand-50/30">
            <div className="p-4 border-b border-slate-200 bg-white">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileUp className="text-brand-500" size={20} />
                Review AI Import
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Please verify the extracted data. Unresolved or ambiguous records have been left blank.
              </p>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  <tr>
                    <th className="p-3 pl-4 w-1/3">AI Extracted (Name / Roll)</th>
                    <th className="p-3 w-1/3">Matched Student</th>
                    <th className="p-3 w-1/4">Status</th>
                    <th className="p-3 w-1/12 text-center">Match</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100 bg-white">
                  {aiResults.map(res => (
                    <tr key={res.key} className={!res.studentId || !res.resolvedStatus ? 'bg-amber-50/50' : ''}>
                      <td className="p-3 pl-4">
                        <div className="font-medium text-slate-800">{res.name || <span className="text-slate-400 italic">Unknown</span>}</div>
                        <div className="text-xs text-slate-500">Roll: {res.roll_no || '-'}</div>
                      </td>
                      <td className="p-3">
                        <select 
                          className={`w-full p-2 border rounded-md text-sm ${res.matchStatus === 'UNMATCHED' ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                          value={res.studentId || ''}
                          onChange={(e) => updateAiResultStudent(res.key, e.target.value)}
                        >
                          <option value="">-- Select Student --</option>
                          {classStudents.map(s => (
                            <option key={s.id} value={s.id}>{formatStudentDisplayName(s.name)} (Roll: {s.roll_no})</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <select
                          className={`w-full p-2 border rounded-md text-sm ${!res.resolvedStatus ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
                          value={res.resolvedStatus}
                          onChange={(e) => updateAiResultStatus(res.key, e.target.value)}
                        >
                          <option value="">-- Blank (Manual) --</option>
                          <option value="Present">Present</option>
                          <option value="Absent">Absent</option>
                          <option value="Late">Late</option>
                          <option value="Leave">Leave</option>
                        </select>
                        {!res.resolvedStatus && <div className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle size={12}/> Needs review</div>}
                      </td>
                      <td className="p-3 text-center">
                        {res.matchStatus === 'MATCHED' ? (
                          <Check size={18} className="text-emerald-500 mx-auto" />
                        ) : res.matchStatus === 'AMBIGUOUS' ? (
                          <AlertTriangle size={18} className="text-amber-500 mx-auto" title="Ambiguous Match" />
                        ) : (
                          <X size={18} className="text-red-400 mx-auto" title="No Match" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <Button variant="outline" onClick={cancelAiImport}>Cancel</Button>
              <Button onClick={confirmAiImport} className="bg-brand-600 hover:bg-brand-700 text-white">
                Confirm & Map to Grid
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden flex flex-col shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input value={globalFilter ?? ''} onChange={e => setGlobalFilter(e.target.value)} placeholder="Search students..." className="pl-10 h-10 w-full bg-slate-50 dark:bg-slate-800" />
              </div>
              <Badge variant="default" className="text-sm px-3 py-1.5 h-auto">Total: {classStudents.length} Students</Badge>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th key={header.id} className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={header.column.getToggleSortingHandler()}>
                          <div className="flex items-center gap-2">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: <ChevronUp size={14} />,
                              desc: <ChevronDown size={14} />
                            }[header.column.getIsSorted()] ?? null}
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="p-4 align-middle">
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
            
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur flex items-center justify-between flex-wrap gap-4 sticky bottom-0 z-20 shadow-lg border-b border-slate-200 dark:border-slate-800">
              <div className="flex-1 min-w-[240px]">
                {message.text && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${
                      message.type === 'success' 
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-sm' 
                        : 'bg-red-50 text-red-800 border border-red-300 shadow-sm'
                    }`}
                  >
                    {message.type === 'success' ? <Check size={18} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={18} className="text-red-600 shrink-0" />}
                    <span>{message.text}</span>
                  </motion.div>
                )}
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <Button 
                  onClick={triggerSaveFlow} 
                  disabled={saving || (isLocked && profile?.role === 'teacher')} 
                  className="w-full sm:w-auto h-11 px-6 sm:px-8 shadow-sm text-sm font-semibold transition-all"
                >
                  {saving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />}
                  {saving ? 'Saving...' : 'Save Attendance'}
                </Button>
              </div>
            </div>
          </Card>
        )
      ) : (
        <Card className="text-center p-16 bg-slate-50 border-dashed border-slate-300">
          <Calendar size={64} className="mx-auto text-slate-300 mb-6" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Select a Class</h3>
          <p className="text-slate-500">Choose a class from the dropdown above to start marking attendance.</p>
        </Card>
      )}

      <AnimatePresence>
        {showOverrideModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                  <AlertTriangle className="text-amber-500" /> Admin Override Required
                </h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">The attendance window is locked. As an admin, you can override this lock, but you must provide a reason for the audit log.</p>
              </div>
              <div className="p-6">
                <textarea 
                  className="input-field w-full h-32 resize-none" 
                  placeholder="Reason for late attendance modification (e.g. System outage, teacher request)..."
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                />
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowOverrideModal(false)}>Cancel</Button>
                <Button onClick={() => executeSave(true)} disabled={!overrideReason}>Confirm Override</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Absentee Notification & WhatsApp Dispatch Modal */}
      <AbsenteeNotificationModal 
        isOpen={showAbsenteeModal} 
        onClose={() => setShowAbsenteeModal(false)} 
        data={absenteeModalData} 
      />

      {/* Interactive AI Camera Scanner Modal */}
      <AttendanceCameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onPhotoCaptured={processImageFile}
        selectedClassName={classes.find(c => c.id === selectedClassId) ? `${classes.find(c => c.id === selectedClassId).name} ${classes.find(c => c.id === selectedClassId).section}` : ''}
        selectedDate={selectedDate}
      />

      {/* AI Key Configuration Modal (shown when server edge function is not deployed on Dokploy) */}
      <AttendanceAIKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        errorMessage={keyModalError}
        onKeySaved={() => {
          if (pendingAiImageFile) {
            processImageFile(pendingAiImageFile);
            setPendingAiImageFile(null);
          }
        }}
      />

      {/* Floating Status Notification Toast */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl font-medium flex items-center justify-between gap-3 text-white border backdrop-blur-md ${
              message.type === 'success' 
                ? 'bg-emerald-600/95 border-emerald-400 shadow-emerald-900/20' 
                : 'bg-red-600/95 border-red-400 shadow-red-900/20'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {message.type === 'success' ? <Check size={20} className="shrink-0" /> : <AlertTriangle size={20} className="shrink-0" />}
              <span className="text-sm font-semibold tracking-wide">{message.text}</span>
            </div>
            {message.type !== 'success' && (
              <button
                type="button"
                onClick={() => {
                  setKeyModalError(message.text);
                  setIsKeyModalOpen(true);
                }}
                className="ml-2 px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <Key size={12} />
                <span>AI Key</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default Attendance;
