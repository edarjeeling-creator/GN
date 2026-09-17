import { useState } from 'react';
import { 
  X, AlertTriangle, CheckCircle2, 
  FileText, Download, User, Share2, Layers, AlertCircle, 
  CheckCheck
} from 'lucide-react';
import { TestExamCommunicationService } from '../../services/TestExamCommunicationService';

export default function TestExamNoticeViewerModal({
  isOpen,
  onClose,
  notice,
  currentUser,
  isStudent = false,
  isParent = false,
  onAcknowledgeSuccess = null,
  onTriggerRevision = null,
  onTriggerStatusChange = null
}) {
  const [acknowledging, setAcknowledging] = useState(false);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);
  const [statusActionLoading, setStatusActionLoading] = useState(false);

  if (!isOpen || !notice) return null;

  const isTeacherOrAdmin = ['admin', 'superadmin', 'principal', 'coordinator', 'teacher'].includes(currentUser?.role);
  const isDateChanged = Boolean(notice.original_test_date && notice.original_test_date !== notice.test_exam_date);
  const isPostponed = notice.communication_type?.includes('POSTPONEMENT');
  const chapters = Array.isArray(notice.portion_breakdown) ? notice.portion_breakdown : [];
  const attachments = Array.isArray(notice.attachments) ? notice.attachments : [];

  const handleAcknowledge = async () => {
    if (!currentUser?.id || !notice.id) return;
    setAcknowledging(true);
    try {
      await TestExamCommunicationService.recordStudentAcknowledgement(currentUser.id, notice.id);
      onAcknowledgeSuccess?.(notice.id);
    } catch (err) {
      console.error('Error acknowledging notice:', err);
    } finally {
      setAcknowledging(false);
    }
  };

  const handleCopyWhatsapp = () => {
    const text = TestExamCommunicationService.generateWhatsAppBroadcastText(notice);
    navigator.clipboard.writeText(text);
    setCopiedWhatsapp(true);
    setTimeout(() => setCopiedWhatsapp(false), 2500);
  };

  const handleOpenWhatsapp = () => {
    const text = TestExamCommunicationService.generateWhatsAppBroadcastText(notice);
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCancelOrArchive = async (targetStatus) => {
    const reason = window.prompt(`Enter reason to mark this notice as ${targetStatus}:`);
    if (!reason || !reason.trim()) return;

    setStatusActionLoading(true);
    try {
      await TestExamCommunicationService.changeCommunicationStatus({
        userId: currentUser?.id,
        communicationId: notice.id,
        targetStatus,
        reason
      });
      onTriggerStatusChange?.(notice.id, targetStatus);
      onClose();
    } catch (err) {
      alert('Error updating status: ' + err.message);
    } finally {
      setStatusActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${
              isPostponed || notice.priority === 'URGENT'
                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : isDateChanged
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-brand-500/20 text-brand-400 border-brand-500/30'
            }`}>
              {isPostponed || isDateChanged ? <AlertTriangle size={22} /> : <FileText size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {notice.communication_type?.replace(/_/g, ' ') || 'NOTICE'}
                </span>
                {notice.priority && notice.priority !== 'NORMAL' && (
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                    notice.priority === 'URGENT' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {notice.priority}
                  </span>
                )}
                {notice.version > 1 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Version {notice.version}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-black text-white mt-1">{notice.title}</h2>
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

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar text-sm">
          {/* Prominent Date Change / Postponement Warning Banner */}
          {(isDateChanged || isPostponed) && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
              isPostponed 
                ? 'bg-red-500/10 border-red-500/30 text-red-200' 
                : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            }`}>
              <AlertCircle size={24} className={`shrink-0 ${isPostponed ? 'text-red-400' : 'text-amber-400'}`} />
              <div className="space-y-1">
                <div className="text-xs font-black uppercase tracking-wider">
                  {isPostponed ? '⚠ TEST / EXAM POSTPONED' : '⚠ TEST / EXAM DATE CHANGED'}
                </div>
                <div className="text-xs">
                  {notice.original_test_date && (
                    <span className="line-through text-slate-400 mr-2">
                      Original: {notice.original_test_date}
                    </span>
                  )}
                  {notice.test_exam_date && (
                    <span className="font-bold text-white">
                      New Date: {notice.test_exam_date}
                    </span>
                  )}
                </div>
                {notice.change_reason && (
                  <div className="text-xs text-slate-300 italic pt-1">
                    Reason: "{notice.change_reason}"
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata Badges Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Class</span>
              <span className="font-bold text-white">
                {notice.class_name_snapshot} {notice.section_snapshot || ''}
              </span>
            </div>
            {notice.subject_name_snapshot && (
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Subject</span>
                <span className="font-bold text-brand-400">{notice.subject_name_snapshot}</span>
              </div>
            )}
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Test Date</span>
              <span className="font-bold text-white">{notice.test_exam_date || 'TBA'}</span>
            </div>
            {notice.max_marks && (
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Max Marks</span>
                <span className="font-bold text-white">{notice.max_marks}</span>
              </div>
            )}
          </div>

          {/* Teacher & Recipient Stats (For Staff) */}
          {isTeacherOrAdmin && !isStudent && !isParent && (
            <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <User size={14} className="text-slate-500" />
                <span>By: <strong className="text-slate-200">{notice.teacher_name_snapshot}</strong></span>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="text-slate-400">
                  Recipients: <strong className="text-white">{notice.recipient_count || 0}</strong>
                </span>
                <span className="text-emerald-400">
                  Read: <strong>{notice.read_count || 0}</strong>
                </span>
                {notice.acknowledgement_required && (
                  <span className="text-purple-400">
                    Ack: <strong>{notice.acknowledgement_count || 0}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Structured Portion / Syllabus */}
          {chapters.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
                <Layers size={16} className="text-brand-400" />
                <span>Portion / Syllabus Breakdown</span>
              </div>
              <div className="space-y-2.5">
                {chapters.map((ch, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                    <div className="font-bold text-xs text-white">{ch.chapter}</div>
                    {ch.topics && ch.topics.length > 0 && (
                      <ul className="pl-4 space-y-1 text-xs text-slate-300 list-disc list-outside">
                        {ch.topics.map((t, tIdx) => (
                          <li key={tIdx}>{t}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* General Portion Notes / Summary */}
          {notice.portion_syllabus && (
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Portion Notes</div>
              <div className="text-xs text-slate-200 whitespace-pre-line">{notice.portion_syllabus}</div>
            </div>
          )}

          {/* Instructions & Required Materials */}
          {(notice.instructions || notice.required_materials || notice.room_venue) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {notice.instructions && (
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Instructions</div>
                  <div className="text-xs text-slate-200 whitespace-pre-line">{notice.instructions}</div>
                </div>
              )}
              {(notice.required_materials || notice.room_venue) && (
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
                  {notice.required_materials && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Required Materials</div>
                      <div className="text-slate-200">{notice.required_materials}</div>
                    </div>
                  )}
                  {notice.room_venue && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Room / Venue</div>
                      <div className="text-slate-200">{notice.room_venue}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Attachments List */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400">Attached Study Material & Revision Files</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl flex items-center justify-between gap-2 text-xs transition-colors group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText size={16} className="text-brand-400 shrink-0" />
                      <span className="text-slate-200 truncate group-hover:text-white font-medium">{att.name}</span>
                    </div>
                    <Download size={15} className="text-slate-500 group-hover:text-brand-400 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Student Acknowledgement Section */}
          {isStudent && notice.acknowledgement_required && (
            <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-2xl space-y-3">
              <div className="flex items-start gap-3">
                <CheckCheck size={20} className="text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">Student Acknowledgement Required</div>
                  <p className="text-xs text-purple-200/80 mt-0.5">
                    Please confirm that you have read and understood the portion and instructions above.
                  </p>
                </div>
              </div>

              {notice.is_acknowledged ? (
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
                  <CheckCircle2 size={16} />
                  <span>Acknowledged on {new Date(notice.acknowledged_at).toLocaleDateString()}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAcknowledge}
                  disabled={acknowledging}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCheck size={16} />
                  <span>{acknowledging ? 'Confirming...' : 'I have read and understood this notice'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 sticky bottom-0 z-10">
          <div className="flex items-center gap-2">
            {isTeacherOrAdmin && !isStudent && (
              <>
                <button
                  type="button"
                  onClick={handleOpenWhatsapp}
                  className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Share2 size={14} /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handleCopyWhatsapp}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
                >
                  {copiedWhatsapp ? 'Copied!' : 'Copy Summary'}
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isTeacherOrAdmin && !isStudent && (
              <>
                <button
                  type="button"
                  onClick={() => onTriggerRevision?.(notice)}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-colors shadow"
                >
                  Revise (V2)
                </button>
                <button
                  type="button"
                  onClick={() => handleCancelOrArchive('CANCELLED')}
                  disabled={statusActionLoading}
                  className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 font-bold text-xs rounded-xl transition-colors"
                >
                  Cancel Notice
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
