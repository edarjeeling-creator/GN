import React, { useState, useEffect, useMemo } from 'react';
import { UserPlus, User, Hash, Phone, Sparkles, Building, CheckCircle2, AlertCircle, Loader2, X, BookOpen, Layers } from 'lucide-react';
import { useData } from '../../context/DataContext';

export default function CreateStudentModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  classes = [], 
  students = [], 
  initialClassId = '' 
}) {
  const { addStudent } = useData();

  const [classId, setClassId] = useState('');
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [house, setHouse] = useState('');
  const [uid, setUid] = useState('');
  
  // Optional academic/language fields
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [secondLanguage, setSecondLanguage] = useState('');
  const [thirdLanguage, setThirdLanguage] = useState('');
  const [electiveSubject, setElectiveSubject] = useState('');
  const [sixthSubject, setSixthSubject] = useState('');

  const [createAnother, setCreateAnother] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // Initialize or update classId when modal opens or initialClassId changes
  useEffect(() => {
    if (isOpen) {
      const defaultClass = initialClassId || (classes.length > 0 ? classes[0].id : '');
      setClassId(defaultClass);
      setStatusMessage({ type: '', text: '' });
    }
  }, [isOpen, initialClassId, classes]);

  // Compute next available roll number when selected class changes
  useEffect(() => {
    if (!classId) {
      setRollNo('');
      return;
    }
    const classStudents = students.filter(s => s.class_id === classId);
    const maxRoll = classStudents.reduce((max, s) => {
      const r = Number(s.roll_no);
      return !isNaN(r) && r > max ? r : max;
    }, 0);
    setRollNo(String(maxRoll + 1));
  }, [classId, students]);

  // Check if entered roll number is already used in this class
  const duplicateStudent = useMemo(() => {
    if (!classId || !rollNo) return null;
    const num = Number(rollNo);
    if (isNaN(num)) return null;
    return students.find(s => s.class_id === classId && Number(s.roll_no) === num) || null;
  }, [classId, rollNo, students]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });

    if (!classId) {
      setStatusMessage({ type: 'error', text: 'Please select a class.' });
      return;
    }

    if (!name.trim()) {
      setStatusMessage({ type: 'error', text: 'Student name is required.' });
      return;
    }

    const parsedRoll = parseInt(rollNo, 10);
    if (isNaN(parsedRoll) || parsedRoll <= 0) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid positive roll number.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const extraData = {};
      if (house) extraData.house = house;
      if (uid.trim()) extraData.uid = uid.trim();
      if (secondLanguage.trim()) extraData.second_language = secondLanguage.trim();
      if (thirdLanguage.trim()) extraData.third_language = thirdLanguage.trim();
      if (electiveSubject.trim()) extraData.elective_subject = electiveSubject.trim();
      if (sixthSubject.trim()) extraData.sixth_subject = sixthSubject.trim();

      const res = await addStudent(
        classId,
        name.trim(),
        parsedRoll,
        contactNumber.trim() || null,
        extraData
      );

      if (res.success) {
        setStatusMessage({ type: 'success', text: `Student "${name.trim()}" added successfully!` });
        if (onSuccess) onSuccess(res.data);

        if (createAnother) {
          // Reset form fields but keep class and suggest next roll number
          setName('');
          setContactNumber('');
          setUid('');
          setRollNo(String(parsedRoll + 1));
          setTimeout(() => {
            setStatusMessage({ type: '', text: '' });
          }, 2000);
        } else {
          setTimeout(() => {
            onClose();
            setName('');
            setRollNo('');
            setContactNumber('');
            setHouse('');
            setUid('');
            setSecondLanguage('');
            setThirdLanguage('');
            setElectiveSubject('');
            setSixthSubject('');
            setStatusMessage({ type: '', text: '' });
          }, 1000);
        }
      } else {
        setStatusMessage({ 
          type: 'error', 
          text: res.error?.message || 'Failed to create student. Please verify the details.' 
        });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-950 via-slate-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Add New Student</h3>
              <p className="text-xs text-blue-200">Register a new student with class and roll number</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-slate-900 dark:text-slate-100">
          
          {/* Class & Roll Number Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Building size={14} className="text-blue-500" />
                Assign Class *
              </label>
              <select
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                required
              >
                <option value="">-- Select Class --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.section}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Hash size={14} className="text-blue-500" />
                Roll No. *
              </label>
              <input
                type="number"
                min="1"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                placeholder="Roll"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Roll number collision warning */}
          {duplicateStudent && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>
                <strong>Notice:</strong> Roll #{rollNo} is already assigned to <strong>{duplicateStudent.name}</strong>. You may still proceed if this is intentional.
              </span>
            </div>
          )}

          {/* Student Full Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <User size={14} className="text-blue-500" />
              Full Name *
            </label>
            <input
              type="text"
              autoFocus
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
              placeholder="e.g. Aarav Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Contact Number & House Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Phone size={14} className="text-blue-500" />
                Contact Number
              </label>
              <input
                type="tel"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Parent WhatsApp / Phone"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-500" />
                House Assignment
              </label>
              <select
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={house}
                onChange={(e) => setHouse(e.target.value)}
              >
                <option value="">-- No House --</option>
                <option value="Garnet">Garnet (Red)</option>
                <option value="Topaz">Topaz (Yellow)</option>
                <option value="Turquoise">Turquoise (Cyan/Blue)</option>
                <option value="Onyx">Onyx (Green/Dark)</option>
              </select>
            </div>
          </div>

          {/* Student UID / Admission ID */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Layers size={14} className="text-blue-500" />
              Student UID / Admission ID
            </label>
            <input
              type="text"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
              placeholder="e.g. GN-2026-0142 (optional)"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
            />
          </div>

          {/* Optional Academic & Language Electives Collapsible */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
            >
              <BookOpen size={14} />
              <span>{showAdvanced ? 'Hide Language & Elective Options' : '+ Add Language & Elective Choices (Optional)'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      2nd Language
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      placeholder="e.g. Nepali, Hindi, Bengali"
                      value={secondLanguage}
                      onChange={(e) => setSecondLanguage(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      3rd Language
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      placeholder="e.g. Hindi, Nepali"
                      value={thirdLanguage}
                      onChange={(e) => setThirdLanguage(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Elective Subject
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      placeholder="e.g. Mathematics, EVS"
                      value={electiveSubject}
                      onChange={(e) => setElectiveSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      6th Subject
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      placeholder="e.g. Computer Applications"
                      value={sixthSubject}
                      onChange={(e) => setSixthSubject(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Create Another Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createAnother}
                onChange={(e) => setCreateAnother(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span>Add another student immediately after saving</span>
            </label>
          </div>

          {/* Status Alert Banner */}
          {statusMessage.text && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <AlertCircle size={16} className="shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Create Student</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
