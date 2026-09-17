import { useState, useEffect } from 'react';
import { 
  FileText, Plus, Search, Calendar, AlertTriangle, RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { 
  PREDEFINED_COMMUNICATION_TYPES 
} from '../../services/TestExamCommunicationService';
import TestExamNoticeModal from './TestExamNoticeModal';
import TestExamNoticeViewerModal from './TestExamNoticeViewerModal';

export default function TestExamCommunicationCentre({
  currentUser,
  teacherAssignments = [],
  classTeacherClasses = [],
  defaultClassId = null,
  isClassTeacherView = false
}) {
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [prefilledModalData, setPrefilledModalData] = useState(null);

  const isAdminOrPrincipal = ['admin', 'superadmin', 'principal', 'coordinator'].includes(currentUser?.role);

  const handleRefresh = () => {
    setReloadTrigger(prev => prev + 1);
  };

  useEffect(() => {
    let ignore = false;
    async function fetchNotices() {
      setLoading(true);
      try {
        let query = supabase
          .from('test_exam_communications')
          .select('*')
          .eq('is_latest', true)
          .order('publish_at', { ascending: false });

        if (defaultClassId) {
          query = query.eq('class_id', defaultClassId);
        } else if (!isAdminOrPrincipal && currentUser?.id) {
          const assignedClassIds = (teacherAssignments || []).map(a => a.class_id);
          const classTeacherIds = (classTeacherClasses || []).map(c => c.id);
          const allPermittedClassIds = Array.from(new Set([...assignedClassIds, ...classTeacherIds]));

          if (allPermittedClassIds.length > 0) {
            query = query.or(`created_by.eq.${currentUser.id},class_id.in.(${allPermittedClassIds.join(',')})`);
          } else {
            query = query.eq('created_by', currentUser.id);
          }
        }

        const { data, error } = await query;
        if (!ignore) {
          if (error) throw error;
          setNotices(data || []);
        }
      } catch (err) {
        if (!ignore) console.error('Error loading test/exam communications:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchNotices();
    return () => {
      ignore = true;
    };
  }, [defaultClassId, isAdminOrPrincipal, currentUser?.id, teacherAssignments, classTeacherClasses, reloadTrigger]);

  // Filtered notices
  const filteredNotices = notices.filter(n => {
    // Tab filter
    if (activeTab === 'PUBLISHED' && n.status !== 'PUBLISHED') return false;
    if (activeTab === 'SCHEDULED' && n.status !== 'SCHEDULED') return false;
    if (activeTab === 'ARCHIVED' && !['ARCHIVED', 'CANCELLED'].includes(n.status)) return false;

    // Type filter
    if (selectedTypeFilter !== 'ALL' && n.communication_type !== selectedTypeFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title?.toLowerCase().includes(q);
      const matchSubject = n.subject_name_snapshot?.toLowerCase().includes(q);
      const matchClass = n.class_name_snapshot?.toLowerCase().includes(q);
      const matchPortion = n.portion_syllabus?.toLowerCase().includes(q);
      if (!matchTitle && !matchSubject && !matchClass && !matchPortion) return false;
    }

    return true;
  });

  // Open revision modal
  const handleTriggerRevision = (notice) => {
    const reason = window.prompt(`Enter reason for revising "${notice.title}":`);
    if (!reason || !reason.trim()) return;

    setPrefilledModalData({
      ...notice,
      title: `${notice.title} (Revised)`,
      change_reason: reason,
      communication_type: notice.communication_type,
      scopeType: notice.scope_type,
      class_id: notice.class_id,
      subject_id: notice.subject_id
    });
    setSelectedNotice(null);
    setIsCreateOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-brand-500 to-indigo-600 text-white rounded-2xl shadow-md">
            <FileText size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30 px-2 py-0.5 rounded">
                Communication Centre
              </span>
              <span className="text-xs text-slate-400">Tests, Exams & Academic Notices</span>
            </div>
            <h2 className="text-lg font-black text-white mt-1">
              Test & Examination Matters
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition-colors"
            title="Refresh Feed"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => {
              setPrefilledModalData(defaultClassId ? { class_id: defaultClassId, scopeType: isClassTeacherView ? 'CLASS_WIDE' : 'CLASS_SUBJECT' } : null);
              setIsCreateOpen(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white font-black text-xs rounded-2xl shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Notice</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-md">
        {/* Search */}
        <div className="sm:col-span-2 relative">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notices, portions, or subjects..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Tab / Status selector */}
        <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto hide-scrollbar">
          {['ALL', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED'].map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap transition-all ${
                activeTab === tab 
                  ? 'bg-brand-600 text-white shadow' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div>
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
          >
            <option value="ALL">All Types</option>
            {PREDEFINED_COMMUNICATION_TYPES.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notices Feed */}
      {loading ? (
        <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 text-slate-400 flex items-center justify-center gap-3">
          <RefreshCw className="animate-spin text-brand-400" size={20} />
          <span className="text-xs">Loading notices...</span>
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 text-slate-400 space-y-2">
          <FileText className="mx-auto text-slate-600" size={32} />
          <div className="text-sm font-bold text-slate-300">No notices found</div>
          <p className="text-xs text-slate-500">Create your first test announcement or portion notice to communicate with students.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotices.map((n) => {
            const isDateChanged = Boolean(n.original_test_date && n.original_test_date !== n.test_exam_date);
            const isPostponed = n.communication_type?.includes('POSTPONEMENT');
            const percentRead = n.recipient_count > 0 ? Math.round((n.read_count / n.recipient_count) * 100) : 0;

            return (
              <div
                key={n.id}
                onClick={() => setSelectedNotice(n)}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-md transition-all cursor-pointer space-y-3.5 group flex flex-col justify-between"
              >
                {/* Top badges */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
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
                      {n.version > 1 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                          V{n.version}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {n.publish_at ? new Date(n.publish_at).toLocaleDateString() : ''}
                    </span>
                  </div>

                  {/* Title & Warning alert if date changed */}
                  <h3 className="text-base font-black text-white group-hover:text-brand-300 transition-colors">
                    {n.title}
                  </h3>

                  {(isDateChanged || isPostponed) && (
                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 flex items-center gap-1.5 font-bold">
                      <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                      <span>{isPostponed ? 'Postponed' : `Date changed to ${n.test_exam_date}`}</span>
                    </div>
                  )}

                  {/* Class, Subject, and Test Date bar */}
                  <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 pt-1">
                    <span className="px-2 py-0.5 bg-slate-950 rounded-lg text-slate-300 font-bold border border-slate-800">
                      {n.class_name_snapshot} {n.section_snapshot || ''}
                    </span>
                    {n.subject_name_snapshot && (
                      <span className="px-2 py-0.5 bg-brand-500/10 rounded-lg text-brand-300 font-bold border border-brand-500/20">
                        {n.subject_name_snapshot}
                      </span>
                    )}
                    {n.test_exam_date && (
                      <span className="flex items-center gap-1 text-slate-300 font-medium">
                        <Calendar size={13} className="text-slate-500" /> {n.test_exam_date}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom stats: Read Receipt Progress */}
                <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">
                      Recipients: <strong className="text-white">{n.recipient_count || 0}</strong>
                    </span>
                    <span className="text-slate-400">
                      Read: <strong className="text-emerald-400">{n.read_count || 0}</strong> ({percentRead}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(percentRead, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Notice Creation Modal */}
      <TestExamNoticeModal
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); setPrefilledModalData(null); }}
        onSuccess={() => { handleRefresh(); }}
        currentUser={currentUser}
        teacherAssignments={teacherAssignments}
        classTeacherClasses={classTeacherClasses}
        prefilledData={prefilledModalData}
      />

      {/* Notice Detail & Acknowledgement Modal */}
      <TestExamNoticeViewerModal
        isOpen={Boolean(selectedNotice)}
        onClose={() => setSelectedNotice(null)}
        notice={selectedNotice}
        currentUser={currentUser}
        onTriggerRevision={handleTriggerRevision}
        onTriggerStatusChange={() => { handleRefresh(); }}
      />
    </div>
  );
}
