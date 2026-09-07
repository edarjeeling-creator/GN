import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Save, RotateCcw, Check, AlertCircle, Sparkles, 
  HelpCircle, Eye, FileText, Send, CheckCheck
} from 'lucide-react';
import { 
  messageTemplateService, 
  FACTORY_TEMPLATES, 
  PLACEHOLDERS_LEGEND 
} from '../../services/MessageTemplateService';

const MOCK_VARIABLES = {
  student_name: 'Hridhan Chettri',
  class_name: '6 A',
  roll_no: '2',
  date: '06-Sept-2026',
  school_name: 'Gyanoday Niketan',
  teacher_name: 'Rajesh Singh',
  custom_text: 'Please note the upcoming parent-teacher meeting this Saturday.',
  absent_count: '2',
  absent_list: '1. Chettri Aarush (Roll: 1)\n2. Hridhan Chettri (Roll: 2)'
};

const MessageCMS = () => {
  const [activeKey, setActiveKey] = useState('absentee_alert');
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await messageTemplateService.loadTemplates();
      setTemplates(res.schoolTemplates || messageTemplateService.getFactoryDefaults());
    } catch (err) {
      console.error("Failed to load school templates:", err);
      setTemplates(messageTemplateService.getFactoryDefaults());
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

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await messageTemplateService.saveSchoolTemplates(templates);
      setFeedback({ type: 'success', text: 'School-wide templates saved successfully!' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      setFeedback({ type: 'error', text: 'Failed to save templates: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleResetCurrentToFactory = async () => {
    if (!window.confirm(`Are you sure you want to reset "${FACTORY_TEMPLATES[activeKey]?.name}" back to factory default?`)) {
      return;
    }
    const factory = messageTemplateService.getFactoryDefaults();
    handleTextChange(activeKey, factory[activeKey]);
  };

  const currentTemplate = templates[activeKey] || FACTORY_TEMPLATES[activeKey]?.template || '';
  const currentDef = FACTORY_TEMPLATES[activeKey];

  // Render live preview
  const livePreview = messageTemplateService.interpolate(currentTemplate, MOCK_VARIABLES);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <MessageSquare size={26} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              WhatsApp Message CMS
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                School Defaults
              </span>
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Configure standardized communication templates and dynamic placeholders for WhatsApp dispatches.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleResetCurrentToFactory}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
            title="Reset this template to system default"
          >
            <RotateCcw size={14} />
            <span>Reset to Factory Default</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-emerald-600/20 active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={15} />
            <span>{saving ? 'Saving...' : 'Save School Templates'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-sm flex items-center gap-2.5 border ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          {feedback.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Main Grid: Template Navigation & Editor & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template List (3 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            Communication Templates
          </div>

          <div className="space-y-2">
            {Object.values(FACTORY_TEMPLATES).map(item => {
              const isSelected = activeKey === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveKey(item.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-sm ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-200'}`}>
                      {item.name}
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Placeholders Legend Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              <Sparkles size={13} className="text-emerald-500" />
              <span>Available Placeholders</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Click any placeholder chip to append it to the template editor:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PLACEHOLDERS_LEGEND.map(p => (
                <button
                  key={p.tag}
                  type="button"
                  onClick={() => handleInsertPlaceholder(p.tag)}
                  title={`${p.label}: ${p.desc}`}
                  className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
                >
                  {p.tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Column: Multi-line Template Editor (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {currentDef?.name} Editor
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Edit the raw template structure using placeholders
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {currentTemplate.length} chars
              </span>
            </div>

            <div className="space-y-2">
              <textarea
                rows={12}
                value={currentTemplate}
                onChange={(e) => handleTextChange(activeKey, e.target.value)}
                className="w-full p-4 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent leading-relaxed"
                placeholder="Enter template text..."
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="italic">
                Tip: WhatsApp markdown like *bold*, _italics_, and ~strike~ are fully supported.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Live WhatsApp-style Preview (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 flex items-center gap-1.5">
            <Eye size={13} />
            <span>Live WhatsApp Preview</span>
          </div>

          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md bg-[#0b141a] text-slate-100">
            {/* WhatsApp Mock Header */}
            <div className="bg-[#202c33] px-3.5 py-2.5 flex items-center gap-2.5 border-b border-[#2a3942]">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs text-white">
                GN
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate text-white">Gyanoday Niketan ERP</div>
                <div className="text-[10px] text-[#8696a0] truncate">Official Notification</div>
              </div>
            </div>

            {/* WhatsApp Chat Area */}
            <div 
              className="p-3 min-h-[300px] flex flex-col justify-end space-y-2"
              style={{
                backgroundImage: 'radial-gradient(#1f2c34 1px, transparent 1px)',
                backgroundSize: '16px 16px'
              }}
            >
              {/* Message Bubble */}
              <div className="self-end bg-[#005c4b] text-white p-3 rounded-xl rounded-tr-none max-w-[95%] shadow-sm text-xs space-y-1.5 leading-relaxed whitespace-pre-wrap font-sans">
                <div>{livePreview}</div>
                <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0] pt-1">
                  <span>9:30 AM</span>
                  <CheckCheck size={12} className="text-[#53bdeb]" />
                </div>
              </div>
            </div>

            {/* Mock Chat Footer */}
            <div className="bg-[#202c33] px-3 py-2 text-[10px] text-center text-[#8696a0] border-t border-[#2a3942]">
              Mock Data: {MOCK_VARIABLES.student_name} (Class {MOCK_VARIABLES.class_name})
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageCMS;
