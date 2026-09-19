import React from 'react';
import { X, Bell, Calendar, Users } from 'lucide-react';
import { Badge } from './ui/Badge';

export default function NoticeDetailModal({ notice, isOpen, onClose }) {
  if (!isOpen || !notice) return null;

  const getAudienceLabel = (aud) => {
    if (!aud || aud === 'all') return 'Entire School';
    if (aud === 'staff') return 'All Staff (Teaching & Non-Teaching)';
    if (aud === 'teachers') return 'Teaching Faculty';
    if (aud === 'non_teaching') return 'Non-Teaching Staff';
    if (aud === 'group_d') return 'Group D Staff';
    if (aud === 'students') return 'Students Only';
    return aud;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-brand-100 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 rounded-xl mt-0.5 shrink-0">
              <Bell size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-bold">
                  {getAudienceLabel(notice.target_audience)}
                </Badge>
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Calendar size={12} />
                  {new Date(notice.publish_date).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {notice.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 text-slate-700 dark:text-slate-200 text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: notice.content }}
        />

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
          >
            Close Notice
          </button>
        </div>
      </div>
    </div>
  );
}
