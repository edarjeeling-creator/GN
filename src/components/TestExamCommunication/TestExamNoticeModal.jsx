import { useState, useMemo } from 'react';
import { 
  X, Plus, Trash2, Upload, AlertCircle, Send, FileText, Layers
} from 'lucide-react';
import { 
  TestExamCommunicationService, 
  PREDEFINED_COMMUNICATION_TYPES
} from '../../services/TestExamCommunicationService';
import { uploadFile } from '../../lib/storage';

export default function TestExamNoticeModal({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  teacherAssignments = [],
  classTeacherClasses = [],
  prefilledData = null
}) {
  if (!isOpen) return null;

  return (
    <TestExamNoticeModalInner
      key={prefilledData?.id || prefilledData?.weekly_test_id || 'new_notice'}
      onClose={onClose}
      onSuccess={onSuccess}
      currentUser={currentUser}
      teacherAssignments={teacherAssignments}
      classTeacherClasses={classTeacherClasses}
      prefilledData={prefilledData}
    />
  );
}

function TestExamNoticeModalInner({
  onClose,
  onSuccess,
  currentUser,
  teacherAssignments = [],
  classTeacherClasses = [],
  prefilledData = null
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Form State initialized directly from prefilledData
  const [scopeType, setScopeType] = useState(prefilledData?.scopeType || 'CLASS_SUBJECT');
  const [classId, setClassId] = useState(prefilledData?.class_id || '');
  const [subjectId, setSubjectId] = useState(prefilledData?.subject_id || '');
  const [communicationType, setCommunicationType] = useState(prefilledData?.communication_type || 'TEST_ANNOUNCEMENT');
  const [title, setTitle] = useState(prefilledData?.title || '');
  const [message, setMessage] = useState(prefilledData?.message || '');
  const [testExamDate, setTestExamDate] = useState(prefilledData?.test_exam_date || prefilledData?.test_date || '');
  const [actionDate, setActionDate] = useState(prefilledData?.action_date || '');
  const [maxMarks, setMaxMarks] = useState(prefilledData?.max_marks ? String(prefilledData.max_marks) : '');
  const [portionSyllabus, setPortionSyllabus] = useState(prefilledData?.portion || prefilledData?.portion_syllabus || '');
  const [instructions, setInstructions] = useState(prefilledData?.instructions || '');
  const [requiredMaterials, setRequiredMaterials] = useState(prefilledData?.required_materials || '');
  const [roomVenue, setRoomVenue] = useState(prefilledData?.room_venue || '');
  const [priority, setPriority] = useState(prefilledData?.priority || 'NORMAL');
  const [acknowledgementRequired, setAcknowledgementRequired] = useState(Boolean(prefilledData?.acknowledgement_required));
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const weeklyTestId = prefilledData?.weekly_test_id || prefilledData?.id || null;

  // Structured Portion Breakdown: [{ chapter: '', topics: [''] }]
  const [portionBreakdown, setPortionBreakdown] = useState(
    prefilledData?.portion_breakdown && prefilledData.portion_breakdown.length > 0
      ? prefilledData.portion_breakdown
      : [{ chapter: '', topics: [''] }]
  );

  // Attachments State
  const [attachments, setAttachments] = useState(prefilledData?.attachments || []);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Authorized Classes & Subjects
  const availableClasses = useMemo(() => {
    if (scopeType === 'CLASS_WIDE') {
      return classTeacherClasses;
    }
    const map = new Map();
    teacherAssignments.forEach(a => {
      if (a.classes && !map.has(a.class_id)) {
        map.set(a.class_id, {
          id: a.class_id,
          name: `${a.classes.name} ${a.classes.section || ''}`.trim()
        });
      }
    });
    return Array.from(map.values());
  }, [scopeType, teacherAssignments, classTeacherClasses]);

  const availableSubjects = useMemo(() => {
    if (scopeType === 'CLASS_WIDE' || !classId) return [];
    return teacherAssignments
      .filter(a => a.class_id === classId && a.subjects)
      .map(a => ({ id: a.subject_id, name: a.subjects.name }));
  }, [scopeType, classId, teacherAssignments]);

  // Handle Structured Portion updates
  const handleAddChapter = () => {
    setPortionBreakdown(prev => [...prev, { chapter: '', topics: [''] }]);
  };

  const handleRemoveChapter = (index) => {
    setPortionBreakdown(prev => prev.filter((_, i) => i !== index));
  };

  const handleChapterNameChange = (index, value) => {
    setPortionBreakdown(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], chapter: value };
      return updated;
    });
  };

  const handleAddTopic = (chapterIndex) => {
    setPortionBreakdown(prev => {
      const updated = [...prev];
      updated[chapterIndex] = {
        ...updated[chapterIndex],
        topics: [...(updated[chapterIndex].topics || []), '']
      };
      return updated;
    });
  };

  const handleTopicChange = (chapterIndex, topicIndex, value) => {
    setPortionBreakdown(prev => {
      const updated = [...prev];
      const topics = [...(updated[chapterIndex].topics || [])];
      topics[topicIndex] = value;
      updated[chapterIndex] = { ...updated[chapterIndex], topics };
      return updated;
    });
  };

  const handleRemoveTopic = (chapterIndex, topicIndex) => {
    setPortionBreakdown(prev => {
      const updated = [...prev];
      updated[chapterIndex] = {
        ...updated[chapterIndex],
        topics: updated[chapterIndex].topics.filter((_, i) => i !== topicIndex)
      };
      return updated;
    });
  };

  // Handle File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      TestExamCommunicationService.validateAttachment({
        name: file.name,
        size: file.size
      });

      setUploadingFile(true);
      const res = await uploadFile(file, `academic_notices/${currentUser?.id || 'staff'}`);
      if (res.error) throw res.error;

      setAttachments(prev => [
        ...prev,
        {
          name: file.name,
          url: res.url,
          path: res.path,
          size: file.size,
          type: file.type
        }
      ]);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingFile(false);
      e.target.value = null;
    }
  };

  const handleRemoveAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Handle Submission
  const handleSubmit = async (bypassDuplicate = false) => {
    setError(null);
    setDuplicateWarning(null);

    if (!classId) {
      setError('Please select a target class.');
      return;
    }
    if (scopeType === 'CLASS_SUBJECT' && !subjectId) {
      setError('Please select an authorized subject.');
      return;
    }
    if (!title.trim()) {
      setError('Please provide a notice title.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        userId: currentUser?.id,
        academicYear: '2026',
        communicationType,
        scopeType,
        classId,
        subjectId: scopeType === 'CLASS_SUBJECT' ? subjectId : null,
        weeklyTestId,
        title,
        message,
        testExamDate: testExamDate || null,
        actionDate: actionDate || null,
        maxMarks: maxMarks ? Number(maxMarks) : null,
        portionSyllabus,
        portionBreakdown: portionBreakdown.filter(c => c.chapter.trim() || (c.topics && c.topics.some(t => t.trim()))),
        instructions,
        requiredMaterials,
        roomVenue,
        attachments,
        priority,
        status: isScheduled ? 'SCHEDULED' : 'PUBLISHED',
        publishAt: isScheduled && scheduledDateTime ? scheduledDateTime : null,
        acknowledgementRequired,
        bypassDuplicateCheck: bypassDuplicate
      };

      const res = await TestExamCommunicationService.createCommunication(payload);

      if (res.isDuplicate && !bypassDuplicate) {
        setDuplicateWarning(res);
        setLoading(false);
        return;
      }

      if (res.success) {
        onSuccess?.(res.communication);
        onClose?.();
      }
    } catch (err) {
      console.error('Error creating communication notice:', err);
      setError(err.message || 'Failed to publish notice.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-500/20 text-brand-400 rounded-2xl border border-brand-500/30">
              <FileText size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Create Test & Examination Notice</h2>
              <p className="text-xs text-slate-400">Authoritative academic communication directly to enrolled students</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar text-sm">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-300">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="text-xs font-medium">{error}</div>
            </div>
          )}

          {duplicateWarning && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3 text-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <div className="font-bold text-xs uppercase tracking-wider text-amber-400">Potential Duplicate Notice</div>
                  <p className="text-xs mt-1 text-slate-300">{duplicateWarning.message}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-xl font-bold"
                >
                  Edit Current Notice
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs rounded-xl font-black"
                >
                  Create New Anyway
                </button>
              </div>
            </div>
          )}

          {/* 1. Scope & Predefined Type Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Communication Scope
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => { setScopeType('CLASS_SUBJECT'); setClassId(''); }}
                  className={`py-2 text-xs font-bold rounded-xl transition-all ${
                    scopeType === 'CLASS_SUBJECT'
                      ? 'bg-brand-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Subject Teacher
                </button>
                <button
                  type="button"
                  onClick={() => { setScopeType('CLASS_WIDE'); setSubjectId(''); setClassId(''); }}
                  className={`py-2 text-xs font-bold rounded-xl transition-all ${
                    scopeType === 'CLASS_WIDE'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Class Teacher
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Communication Type
              </label>
              <select
                value={communicationType}
                onChange={(e) => setCommunicationType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white font-medium focus:border-brand-500 focus:outline-none"
              >
                {PREDEFINED_COMMUNICATION_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Target Class & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Target Class & Section <span className="text-red-400">*</span>
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white font-medium focus:border-brand-500 focus:outline-none"
              >
                <option value="">-- Select Assigned Class --</option>
                {availableClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {availableClasses.length === 0 && (
                <p className="text-[11px] text-amber-400 mt-1">No assigned classes found for this scope.</p>
              )}
            </div>

            {scopeType === 'CLASS_SUBJECT' && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Subject <span className="text-red-400">*</span>
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  disabled={!classId}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white font-medium focus:border-brand-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">-- Select Assigned Subject --</option>
                  {availableSubjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 3. Title & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Notice Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mathematics Weekly Test — Tuesday 22 Sep"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white font-medium focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white font-medium focus:border-brand-500 focus:outline-none"
              >
                <option value="NORMAL">Normal</option>
                <option value="IMPORTANT">Important</option>
                <option value="URGENT">Urgent ⚠</option>
              </select>
            </div>
          </div>

          {/* 4. Message / Note */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Notice Message / Overview
            </label>
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Provide context or a brief overview for students..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white font-medium focus:border-brand-500 focus:outline-none resize-none"
            />
          </div>

          {/* 5. Dates & Max Marks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Test / Exam Date
              </label>
              <input
                type="date"
                value={testExamDate}
                onChange={(e) => setTestExamDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white font-medium focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Maximum Marks
              </label>
              <input
                type="number"
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
                placeholder="e.g. 25"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white font-medium focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Action / Due Date
              </label>
              <input
                type="date"
                value={actionDate}
                onChange={(e) => setActionDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white font-medium focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 6. Structured Portion / Syllabus Builder */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-brand-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Structured Portion / Syllabus
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddChapter}
                className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1.5 px-2.5 py-1 bg-brand-500/10 rounded-lg border border-brand-500/20"
              >
                <Plus size={14} /> Add Chapter
              </button>
            </div>

            <div className="space-y-3">
              {portionBreakdown.map((ch, chIdx) => (
                <div key={chIdx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ch.chapter}
                      onChange={(e) => handleChapterNameChange(chIdx, e.target.value)}
                      placeholder={`Chapter ${chIdx + 1} Title (e.g. Chapter 5: Algebraic Expressions)`}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveChapter(chIdx)}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Topics List */}
                  <div className="pl-4 space-y-1.5 border-l-2 border-slate-800">
                    {(ch.topics || []).map((tp, tpIdx) => (
                      <div key={tpIdx} className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">•</span>
                        <input
                          type="text"
                          value={tp}
                          onChange={(e) => handleTopicChange(chIdx, tpIdx, e.target.value)}
                          placeholder="Topic / Subtopic"
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:border-brand-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveTopic(chIdx, tpIdx)}
                          className="text-slate-500 hover:text-red-400 text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAddTopic(chIdx)}
                      className="text-[11px] font-bold text-slate-400 hover:text-brand-300 flex items-center gap-1 mt-1"
                    >
                      <Plus size={12} /> Add Topic
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* General Portion Summary text */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Portion Notes / Summary
              </label>
              <textarea
                rows={2}
                value={portionSyllabus}
                onChange={(e) => setPortionSyllabus(e.target.value)}
                placeholder="Brief summary or extra syllabus instructions..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* 7. Instructions & Required Materials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Instructions
              </label>
              <textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Bring geometry box, pencils, and blue/black pens. No calculators allowed."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white font-medium focus:border-brand-500 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Required Materials & Room / Venue
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={requiredMaterials}
                  onChange={(e) => setRequiredMaterials(e.target.value)}
                  placeholder="e.g. Geometry Box, Practical Lab Manual"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white font-medium focus:border-brand-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={roomVenue}
                  onChange={(e) => setRoomVenue(e.target.value)}
                  placeholder="Room / Venue (e.g. Science Lab 2)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white font-medium focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 8. Attachments Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Attachments (Max 10MB — PDF, JPG, PNG, DOCX)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white">
                  <span className="truncate max-w-[180px]">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(idx)}
                    className="text-slate-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 cursor-pointer transition-colors">
              <Upload size={14} />
              <span>{uploadingFile ? 'Uploading...' : 'Upload Revision Sheet / Syllabus PDF'}</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileUpload}
                disabled={uploadingFile}
              />
            </label>
          </div>

          {/* 9. Acknowledgement & Scheduling Toggle */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledgementRequired}
                onChange={(e) => setAcknowledgementRequired(e.target.checked)}
                className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 bg-slate-900 border-slate-700"
              />
              <span className="text-xs font-bold text-white">
                Require Student Acknowledgement ("I have read and understood this notice")
              </span>
            </label>

            <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 bg-slate-900 border-slate-700"
                />
                <span className="text-xs font-medium text-slate-300">
                  Schedule publication for later
                </span>
              </label>

              {isScheduled && (
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 flex items-center justify-between bg-slate-900/90 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-slate-400 hover:text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={loading || uploadingFile}
            className="px-6 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white font-black text-xs rounded-xl shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Send size={15} />
            <span>{loading ? 'Publishing...' : isScheduled ? 'Schedule Notice' : 'Send to Students'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
