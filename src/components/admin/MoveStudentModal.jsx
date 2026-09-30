import React, { useState, useEffect, useMemo } from 'react';
import { ArrowRightLeft, User, Hash, Building, AlertCircle, CheckCircle2, Loader2, X, AlertTriangle } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatStudentDisplayName } from '../../utils/studentUtils';

export default function MoveStudentModal({
  isOpen,
  onClose,
  student,
  classes = [],
  students = [],
  onSuccess
}) {
  const { moveStudent } = useData();

  const [targetClassId, setTargetClassId] = useState('');
  const [newRollNo, setNewRollNo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // Current class of the student
  const currentClass = useMemo(() => {
    if (!student || !classes.length) return null;
    return classes.find(c => c.id === student.class_id) || null;
  }, [student, classes]);

  // Format class display name (e.g. "9 Sc (Science)" or "9 H (Humanities)")
  const getClassDisplayName = (c) => {
    if (!c) return 'Unknown';
    const sec = c.section ? c.section.trim() : '';
    if (!sec) return c.name;
    if (sec.toLowerCase() === 'sc') return `${c.name} Sc (Science)`;
    if (sec.toLowerCase() === 'h') return `${c.name} H (Humanities)`;
    return `${c.name} ${sec}`;
  };

  // Target class object
  const targetClass = useMemo(() => {
    return classes.find(c => c.id === targetClassId) || null;
  }, [targetClassId, classes]);

  // When modal opens or student changes, initialize state
  useEffect(() => {
    if (isOpen && student) {
      setStatusMessage({ type: '', text: '' });
      setTargetClassId(student.class_id || '');
      setNewRollNo(String(student.roll_no || ''));
    }
  }, [isOpen, student]);

  // Auto-calculate suggested roll number when targetClassId changes
  const handleClassChange = (selectedId) => {
    setTargetClassId(selectedId);
    setStatusMessage({ type: '', text: '' });

    if (!selectedId) {
      setNewRollNo('');
      return;
    }

    if (student && selectedId === student.class_id) {
      setNewRollNo(String(student.roll_no || ''));
      return;
    }

    // Check students in target class
    const targetStudents = students.filter(s => s.class_id === selectedId && s.id !== student?.id);
    const isCurrentRollFree = student?.roll_no && !targetStudents.some(s => Number(s.roll_no) === Number(student.roll_no));

    if (isCurrentRollFree) {
      setNewRollNo(String(student.roll_no));
    } else {
      const maxRoll = targetStudents.reduce((max, s) => {
        const r = Number(s.roll_no);
        return !isNaN(r) && r > max ? r : max;
      }, 0);
      setNewRollNo(String(maxRoll + 1));
    }
  };

  // Check if roll number collides with someone else in target class
  const duplicateStudent = useMemo(() => {
    if (!targetClassId || !newRollNo) return null;
    const num = Number(newRollNo);
    if (isNaN(num)) return null;
    return students.find(s => s.class_id === targetClassId && s.id !== student?.id && Number(s.roll_no) === num) || null;
  }, [targetClassId, newRollNo, students, student]);

  if (!isOpen || !student) return null;

  const isSameClass = targetClassId === student.class_id;
  const isSameRoll = Number(newRollNo) === Number(student.roll_no);
  const isNoChange = isSameClass && isSameRoll;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });

    if (!targetClassId) {
      setStatusMessage({ type: 'error', text: 'Please select a destination class.' });
      return;
    }

    const parsedRoll = parseInt(newRollNo, 10);
    if (isNaN(parsedRoll) || parsedRoll <= 0) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid positive roll number.' });
      return;
    }

    if (isNoChange) {
      setStatusMessage({ type: 'error', text: 'Please choose a different class/section or roll number to shift.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await moveStudent(student.id, targetClassId, parsedRoll);

      if (res.success) {
        const destName = targetClass ? `${targetClass.name} ${targetClass.section || ''}`.trim() : 'the new class';
        setStatusMessage({
          type: 'success',
          text: `Successfully shifted ${formatStudentDisplayName(student.name)} to ${destName} (Roll #${parsedRoll})!`
        });

        if (onSuccess) {
          onSuccess(res.data || { ...student, class_id: targetClassId, roll_no: parsedRoll }, targetClass);
        }

        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error?.message || 'Failed to move student. Please check network and permissions.'
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'An unexpected error occurred.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <ArrowRightLeft size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Move Student
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Shift student between classes and class sections
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Message */}
        {statusMessage.text && (
          <div className={`p-4 border-b text-sm flex items-center gap-3 ${
            statusMessage.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          }`}>
            {statusMessage.type === 'error' ? <AlertCircle size={18} className="shrink-0" /> : <CheckCircle2 size={18} className="shrink-0" />}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-slate-900 dark:text-slate-100">
          {/* Current Student Profile Overview Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl flex items-center gap-4">
            <img 
              src={student.picture_url ? `${student.picture_url}?t=${Date.now()}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`} 
              alt={student.name} 
              className="w-12 h-12 rounded-full object-cover border border-slate-300 dark:border-slate-600 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {formatStudentDisplayName(student.name)}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  Current: {currentClass ? `${currentClass.name} ${currentClass.section || ''}`.trim() : 'Unknown Class'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  Roll #{student.roll_no}
                </span>
                {student.uid && (
                  <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    UID: {student.uid}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Destination Class & Section */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Building size={14} className="text-blue-500" />
              Destination Class & Section *
            </label>
            <select
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
              value={targetClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              required
            >
              <option value="">-- Select Destination Class --</option>
              {classes.map(c => {
                const isCur = c.id === student.class_id;
                return (
                  <option key={c.id} value={c.id}>
                    {getClassDisplayName(c)} {isCur ? '(Current Class)' : ''}
                  </option>
                );
              })}
            </select>
            {isSameClass && (
              <p className="text-xs text-amber-500 dark:text-amber-400 mt-1 flex items-center gap-1">
                <AlertTriangle size={13} />
                Student is currently in this class. Select another class or change roll number.
              </p>
            )}
          </div>

          {/* New Roll Number */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Hash size={14} className="text-blue-500" />
              Roll Number in Destination Class *
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="1"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                placeholder="New Roll Number"
                value={newRollNo}
                onChange={(e) => setNewRollNo(e.target.value)}
                required
              />
              {targetClassId && !isSameClass && (
                <button
                  type="button"
                  onClick={() => {
                    const targetStudents = students.filter(s => s.class_id === targetClassId && s.id !== student?.id);
                    const maxRoll = targetStudents.reduce((max, s) => {
                      const r = Number(s.roll_no);
                      return !isNaN(r) && r > max ? r : max;
                    }, 0);
                    setNewRollNo(String(maxRoll + 1));
                  }}
                  className="px-3 py-2 text-xs font-semibold whitespace-nowrap bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
                  title="Assign next available roll number in destination class"
                >
                  Next Available
                </button>
              )}
            </div>
          </div>

          {/* Duplicate Roll Warning */}
          {duplicateStudent && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>
                <strong>Notice:</strong> Roll #{newRollNo} is already assigned to <strong>{formatStudentDisplayName(duplicateStudent.name)}</strong> in this class. You may still proceed if this roll number is shared.
              </span>
            </div>
          )}

          {/* Preserved Data Information Note */}
          <div className="p-3 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-blue-500 shrink-0" />
              Profile and Records Preserved
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Moving will update the student's active class and section. Their photo, UID, parent contacts, marks, and attendance history remain linked.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isNoChange}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl shadow-md flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Moving Student...</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft size={16} />
                  <span>Move Student</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
