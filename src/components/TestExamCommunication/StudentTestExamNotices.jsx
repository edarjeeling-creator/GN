import { useState, useEffect } from 'react';
import { 
  FileText, AlertTriangle, CheckCircle2, 
  Search, CheckCheck, RefreshCw
} from 'lucide-react';
import { TestExamCommunicationService } from '../../services/TestExamCommunicationService';
import TestExamNoticeViewerModal from './TestExamNoticeViewerModal';

export default function StudentTestExamNotices({ studentId, classId, currentUser }) {
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState([]);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'TESTS' | 'EXAMS' | 'UNREAD' | 'IMPORTANT'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const handleRefresh = () => {
    setReloadTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (!studentId || !classId) return;
    let ignore = false;
    async function fetchNotices() {
      setLoading(true);
      try {
        const data = await TestExamCommunicationService.getNoticesForStudent({
          studentId,
          classId
        });
        if (!ignore) {
          setNotices(data || []);
        }
      } catch (err) {
        if (!ignore) console.error('Error loading student test/exam notices:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchNotices();
    return () => {
      ignore = true;
    };
  }, [studentId, classId, reloadTrigger]);

  // Handle Opening Notice (triggers read receipt recording)
  const handleOpenNotice = async (notice) => {
    setSelectedNotice(notice);
    if (!notice.is_read) {
      await TestExamCommunicationService.recordStudentRead(studentId, notice.id);
      setNotices(prev => prev.map(n => n.id === notice.id ? { ...n, is_read: true } : n));
    }
  };

  const handleAcknowledgeSuccess = (noticeId) => {
    setNotices(prev => prev.map(n => n.id === noticeId ? { ...n, is_acknowledged: true, is_read: true } : n));
    if (selectedNotice && selectedNotice.id === noticeId) {
      setSelectedNotice(prev => ({ ...prev, is_acknowledged: true, is_read: true }));
    }
  };

  const filteredNotices = notices.filter(n => {
    if (filterMode === 'UNREAD' && n.is_read) return false;
    if (filterMode === 'IMPORTANT' && n.priority === 'NORMAL') return false;
    if (filterMode === 'TESTS' && !n.communication_type?.startsWith('TEST')) return false;
    if (filterMode === 'EXAMS' && !n.communication_type?.startsWith('EXAM')) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title?.toLowerCase().includes(q);
      const matchSub = n.subject_name_snapshot?.toLowerCase().includes(q);
      const matchPortion = n.portion_syllabus?.toLowerCase().includes(q);
      if (!matchTitle && !matchSub && !matchPortion) return false;
    }

    return true;
  });

  const unreadCount = notices.filter(n => !n.is_read).length;

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-brand-500 to-indigo-600 text-white rounded-2xl shadow-md">
            <FileText size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30 px-2 py-0.5 rounded">
                Academics
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-black uppercase tracking-wider bg-red-500 text-white px-2 py-0.5 rounded-full">
                  {unreadCount} Unread
                </span>
              )}
            </div>
            <h2 className="text-lg font-black text-white mt-1">
              Test & Examination Notices
            </h2>
            <p className="text-xs text-slate-400">
              Official syllabus, portions, exam dates, and preparation instructions from your teachers.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition-colors self-start sm:self-auto"
          title="Refresh Notices"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 shadow-md">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tests, subjects, or portions..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto hide-scrollbar">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'UNREAD', label: `Unread (${unreadCount})` },
            { id: 'TESTS', label: 'Tests' },
            { id: 'EXAMS', label: 'Exams' },
            { id: 'IMPORTANT', label: 'Important' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterMode(f.id)}
              className={`px-3 py-1 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                filterMode === f.id
                  ? 'bg-brand-600 text-white shadow'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notices List */}
      {loading ? (
        <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 text-slate-400 flex items-center justify-center gap-3">
          <RefreshCw className="animate-spin text-brand-400" size={20} />
          <span className="text-xs">Loading academic notices...</span>
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 text-slate-400 space-y-2">
          <CheckCircle2 className="mx-auto text-emerald-500" size={32} />
          <div className="text-sm font-bold text-slate-200">You're all caught up!</div>
          <p className="text-xs text-slate-500">No test or examination notices match the current filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotices.map((n) => {
            const isDateChanged = Boolean(n.original_test_date && n.original_test_date !== n.test_exam_date);
            const isPostponed = n.communication_type?.includes('POSTPONEMENT');
            const chapters = Array.isArray(n.portion_breakdown) ? n.portion_breakdown : [];

            return (
              <div
                key={n.id}
                onClick={() => handleOpenNotice(n)}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer space-y-3 relative overflow-hidden group ${
                  !n.is_read 
                    ? 'bg-gradient-to-r from-brand-950/40 via-slate-900 to-slate-900 border-brand-500/40 shadow-lg shadow-brand-500/5' 
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                {!n.is_read && (
                  <div className="absolute top-0 right-0 w-3 h-3 bg-brand-500 rounded-bl-xl" />
                )}

                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                        {n.communication_type?.replace(/_/g, ' ')}
                      </span>
                      {n.priority && n.priority !== 'NORMAL' && (
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          n.priority === 'URGENT' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {n.priority}
                        </span>
                      )}
                      {n.subject_name_snapshot && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">
                          {n.subject_name_snapshot}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-black text-white group-hover:text-brand-300 transition-colors pt-0.5">
                      {n.title}
                    </h3>
                  </div>

                  {n.test_exam_date && (
                    <div className="text-right shrink-0 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Date</div>
                      <div className="text-xs font-black text-white">{n.test_exam_date}</div>
                    </div>
                  )}
                </div>

                {/* Date change warning */}
                {(isDateChanged || isPostponed) && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2 font-bold">
                    <AlertTriangle size={15} className="shrink-0 text-amber-400" />
                    <span>{isPostponed ? '⚠ Test / Exam Postponed' : `⚠ Date Changed: ${n.test_exam_date}`}</span>
                  </div>
                )}

                {/* Portion Teaser */}
                {chapters.length > 0 && (
                  <div className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <strong className="text-brand-400">Portion: </strong>
                    {chapters.map(c => c.chapter).filter(Boolean).join(' • ')}
                  </div>
                )}

                {/* Bottom Bar: Status, Teacher, & Ack badge */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  <span className="text-slate-400">
                    Teacher: <strong className="text-slate-200">{n.teacher_name_snapshot}</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    {n.acknowledgement_required && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                        n.is_acknowledged
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}>
                        <CheckCheck size={12} />
                        {n.is_acknowledged ? 'Acknowledged' : 'Ack Required'}
                      </span>
                    )}
                    <span className="text-[11px] font-bold text-brand-400 group-hover:underline">
                      View Details →
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Notice Detail Modal */}
      <TestExamNoticeViewerModal
        isOpen={Boolean(selectedNotice)}
        onClose={() => setSelectedNotice(null)}
        notice={selectedNotice}
        currentUser={currentUser}
        isStudent={true}
        onAcknowledgeSuccess={handleAcknowledgeSuccess}
      />
    </div>
  );
}
