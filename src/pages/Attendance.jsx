import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Check, X, Clock, AlertTriangle, Save, Loader2, Calendar, User, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { useReactTable, getCoreRowModel, flexRender, getSortedRowModel, getFilteredRowModel } from '@tanstack/react-table';

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

  const classStudents = useMemo(() => students.filter(s => s.class_id === selectedClassId), [students, selectedClassId]);

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

  const triggerSaveFlow = () => {
    if (!selectedClassId || !selectedDate) return;
    if (isLocked && profile?.role === 'admin') setShowOverrideModal(true);
    else executeSave();
  };

  const executeSave = async (overrideData = null) => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    const recordsToUpsert = classStudents.map(student => ({
      student_id: student.id, class_id: selectedClassId, date: selectedDate, academic_year: academicYear,
      status: attendanceData[student.id]?.status || 'Present', remarks: attendanceData[student.id]?.remarks || null,
      marked_by: profile?.id, marked_at: new Date().toISOString()
    })).filter(record => record.status !== '');

    if (recordsToUpsert.length === 0) {
      setMessage({ text: 'Please mark attendance before saving.', type: 'danger' });
      setSaving(false); return;
    }

    try {
      const { error } = await supabase.from('attendance').upsert(recordsToUpsert, { onConflict: 'student_id,date' });
      if (error) throw error;
      const absentStudents = recordsToUpsert.filter(r => r.status === 'Absent');
      const presentStudents = recordsToUpsert.filter(r => r.status !== 'Absent');
      const selectedClass = classes.find(c => c.id === selectedClassId);
      const className = selectedClass ? `${selectedClass.name} ${selectedClass.section}` : '';
      const formattedDate = new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');

      if (presentStudents.length > 0) {
        await supabase.from('student_notifications').update({ is_invalid: true, invalidated_at: new Date().toISOString(), invalidated_by: profile.id })
          .eq('type', 'absence_alert').eq('attendance_date', selectedDate).in('student_id', presentStudents.map(r => r.student_id));
      }

      if (absentStudents.length > 0) {
        const notificationsToUpsert = absentStudents.map(record => ({ student_id: record.student_id, attendance_date: selectedDate, title: 'Attendance Alert', message: `You were marked absent on ${formattedDate} in Class ${className}. If this is incorrect, please contact the class teacher.`, type: 'absence_alert', channel: 'portal' }));
        const { error: notificationError } = await supabase.from('student_notifications').upsert(notificationsToUpsert, { onConflict: 'student_id,attendance_date,type' });
        if (notificationError) setMessage({ text: 'Attendance saved, but failed to send some notifications.', type: 'warning' });
        else setMessage({ text: 'Attendance saved and absence notifications sent successfully!', type: 'success' });
      } else setMessage({ text: 'Attendance saved successfully!', type: 'success' });

      if (overrideData && overrideReason) {
        const { data } = await supabase.from('attendance').select('id').eq('class_id', selectedClassId).eq('date', selectedDate).limit(1);
        await supabase.from('attendance_overrides').insert({ attendance_id: data ? data[0]?.id : recordsToUpsert[0].id, overridden_by: profile.id, new_status: 'Batch Override', reason: overrideReason });
        setShowOverrideModal(false); setOverrideReason('');
      }
    } catch (err) {
      console.error(err); setMessage({ text: 'Failed to save attendance.', type: 'danger' });
    } finally {
      setSaving(false); setTimeout(() => setMessage({ text: '', type: '' }), 4000);
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
            <span className="font-semibold text-slate-800">{student.name}</span>
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
      
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Calendar className="text-brand-600" size={32} /> Daily Attendance
        </h1>
        <p className="text-slate-500 mt-1">Mark and manage daily attendance for your classes.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Select Class</label>
              <select className="input-field w-full h-11 bg-white" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                <option value="">-- Choose Class --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
              <Input type="date" className="w-full h-11" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
            <div>
              <Button onClick={markAllPresent} disabled={!selectedClassId || classStudents.length === 0 || (isLocked && profile?.role === 'teacher')} className="w-full h-11 shadow-sm">
                <Check size={18} className="mr-2" /> Mark All Present
              </Button>
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
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`p-4 rounded-xl text-white font-medium flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
            {message.type === 'success' ? <Check size={20}/> : <AlertTriangle size={20}/>}
            {message.text}
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
        ) : (
          <Card className="overflow-hidden flex flex-col shadow-sm">
            <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input value={globalFilter ?? ''} onChange={e => setGlobalFilter(e.target.value)} placeholder="Search students..." className="pl-10 h-10 w-full bg-slate-50" />
              </div>
              <Badge variant="primary" className="text-sm px-3 py-1.5 h-auto">Total: {classStudents.length} Students</Badge>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th key={header.id} className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={header.column.getToggleSortingHandler()}>
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
                <tbody className="divide-y divide-slate-100 bg-white">
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
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
            
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <Button onClick={triggerSaveFlow} disabled={saving || (isLocked && profile?.role === 'teacher')} className="h-11 px-8 shadow-sm text-sm">
                {saving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />}
                {saving ? 'Saving...' : 'Save Attendance'}
              </Button>
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

    </motion.div>
  );
};

export default Attendance;
