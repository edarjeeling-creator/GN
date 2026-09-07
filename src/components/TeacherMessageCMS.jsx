import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Save, RotateCcw, Check, AlertCircle, Sparkles, 
  Eye, CheckCheck, Info, UserCheck, Shield 
} from 'lucide-react';
import { 
  messageTemplateService, 
  FACTORY_TEMPLATES, 
  PLACEHOLDERS_LEGEND 
} from '../services/MessageTemplateService';
import { formatDisplayDate } from '../utils/studentUtils';

const TeacherMessageCMS = ({ teacherId, teacherName = 'Class Teacher', cls = null, sampleStudent = null }) => {
  const [activeKey, setActiveKey] = useState('absentee_alert');
  const [templates, setTemplates] = useState({});
  const [schoolTemplates, setSchoolTemplates] = useState({});
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const className = cls ? `${cls.name || ''} ${cls.section || ''}`.trim() : '6 A';

  useEffect(() => {
    if (teacherId) {
      loadData();
    }
  }, [teacherId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await messageTemplateService.loadTemplates(teacherId);
      setTemplates(res.templates);
      setSchoolTemplates(res.schoolTemplates);
      setMeta(res.meta);
    } catch (err) {
      console.error("Failed to load teacher templates:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (key, text) => {
    setTemplates(prev => ({
      ...prev,
      [key]: text
    }));
  };

  const handleInsertPlaceholder = (token) => {
    const current = templates[activeKey] || '';
    handleTextChange(activeKey, current + (current.endsWith('\n') || !current ? '' : ' ') + token);
  };

  const handleSaveTeacherTemplate = async () => {
    if (!teacherId) return;
    setSaving(true);
    setFeedback(null);
    try {
      await messageTemplateService.saveTeacherTemplates(teacherId, {
        [activeKey]: templates[activeKey]
      });
      await loadData();
      setFeedback({ type: 'success', text: `Saved custom ${FACTORY_TEMPLATES[activeKey]?.name} for your class!` });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      setFeedback({ type: 'error', text: 'Error saving: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToSchoolDefault = async () => {
    if (!teacherId) return;
    if (!window.confirm(`Reset "${FACTORY_TEMPLATES[activeKey]?.name}" back to the school-wide default template?`)) {
      return;
    }

    setSaving(true);
    try {
      await messageTemplateService.resetTeacherTemplates(teacherId, activeKey);
      await loadData();
      setFeedback({ type: 'success', text: 'Reset to school default template.' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: 'error', text: 'Reset error: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const currentTemplate = templates[activeKey] || FACTORY_TEMPLATES[activeKey]?.template || '';
  const currentDef = FACTORY_TEMPLATES[activeKey];
  const isCustom = meta[activeKey]?.isCustom;

  // Mock sample variables for live preview
  const previewVariables = {
    student_name: sampleStudent?.name || 'Hridhan Chettri',
    class_name: className,
    roll_no: sampleStudent?.roll_no || '2',
    date: formatDisplayDate(new Date()),
    school_name: 'Gyanoday Niketan',
    teacher_name: teacherName || 'Class Teacher',
    custom_text: 'Please review the notebook homework.',
    absent_count: '1',
    absent_list: `1. ${sampleStudent?.name || 'Hridhan Chettri'} (Roll: ${sampleStudent?.roll_no || 2})`
  };

  const livePreview = messageTemplateService.interpolate(currentTemplate, previewVariables);

  // Filter templates suitable for teachers
  const teacherTemplateOptions = [
    FACTORY_TEMPLATES.absentee_alert,
    FACTORY_TEMPLATES.general_notice,
    FACTORY_TEMPLATES.fee_reminder
  ];

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <MessageSquare size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Class Message CMS
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Class {className}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Customize WhatsApp message wording for your class, or keep the standard school defaults.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {isCustom && (
            <button
              type="button"
              onClick={handleResetToSchoolDefault}
              disabled={saving}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
              title="Discard your custom wording and revert to school default"
            >
              <RotateCcw size={13} />
              <span>Use School Default</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveTeacherTemplate}
            disabled={saving || loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-indigo-600/20 active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={14} />
            <span>{saving ? 'Saving...' : 'Save My Template'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-xs sm:text-sm flex items-center gap-2.5 border ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          {feedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Template Selector Cards (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            Choose Template to Edit
          </div>

          <div className="space-y-2">
            {teacherTemplateOptions.map(item => {
              const isSelected = activeKey === item.id;
              const hasOverride = meta[item.id]?.isCustom;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveKey(item.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-sm ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>
                      {item.name}
                    </span>
                    {hasOverride ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                        <UserCheck size={10} /> Custom
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <Shield size={10} /> School Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Placeholders Legend */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              <Sparkles size={13} className="text-indigo-500" />
              <span>Dynamic Placeholders</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                '{student_name}', '{class_name}', '{roll_no}', 
                '{date}', '{teacher_name}', '{school_name}'
              ].map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleInsertPlaceholder(tag)}
                  className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-600 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Editor Area (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  {currentDef?.name} Text
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isCustom ? 'You have customized this template.' : 'Currently using school default.'}
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {currentTemplate.length} chars
              </span>
            </div>

            <div className="space-y-2">
              <textarea
                rows={11}
                value={currentTemplate}
                onChange={(e) => handleTextChange(activeKey, e.target.value)}
                className="w-full p-4 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent leading-relaxed"
                placeholder="Template text with {placeholders}..."
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <Info size={12} />
                <span>Placeholders update automatically for each student.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 flex items-center gap-1.5">
            <Eye size={13} />
            <span>Parent WhatsApp Preview</span>
          </div>

          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md bg-[#0b141a] text-slate-100">
            {/* Header */}
            <div className="bg-[#202c33] px-3.5 py-2.5 flex items-center gap-2.5 border-b border-[#2a3942]">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs text-white">
                GN
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate text-white">Gyanoday Niketan</div>
                <div className="text-[10px] text-[#8696a0] truncate">Class {className}</div>
              </div>
            </div>

            {/* Bubble */}
            <div 
              className="p-3 min-h-[260px] flex flex-col justify-end space-y-2"
              style={{
                backgroundImage: 'radial-gradient(#1f2c34 1px, transparent 1px)',
                backgroundSize: '16px 16px'
              }}
            >
              <div className="self-end bg-[#005c4b] text-white p-3 rounded-xl rounded-tr-none max-w-[95%] shadow-sm text-xs space-y-1.5 leading-relaxed whitespace-pre-wrap font-sans">
                <div>{livePreview}</div>
                <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0] pt-1">
                  <span>Just now</span>
                  <CheckCheck size={12} className="text-[#53bdeb]" />
                </div>
              </div>
            </div>

            <div className="bg-[#202c33] px-3 py-2 text-[10px] text-center text-[#8696a0] border-t border-[#2a3942]">
              Previewing for: {previewVariables.student_name}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherMessageCMS;
