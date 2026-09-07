import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, Copy, Check, MessageSquare, Phone, Edit2, 
  Sparkles, RefreshCw, AlertCircle, Save, Info, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { messageTemplateService, FACTORY_TEMPLATES, PLACEHOLDERS_LEGEND } from '../services/MessageTemplateService';
import { formatStudentDisplayName, formatDisplayDate } from '../utils/studentUtils';
import { useData } from '../context/DataContext';

const WhatsAppComposerModal = ({
  isOpen,
  onClose,
  student,
  cls,
  teacherName = '',
  teacherId = null,
  initialTemplateKey = 'absentee_alert',
  defaultDate = null
}) => {
  const { updateStudentContactNumber } = useData();

  const [templateKey, setTemplateKey] = useState(initialTemplateKey);
  const [templatesData, setTemplatesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [renderedMessage, setRenderedMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);

  // Phone edit state
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneOverride, setPhoneOverride] = useState(null);

  const textareaRef = useRef(null);

  // Load templates on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setTemplateKey(initialTemplateKey);
    setSaveFeedback(null);
    setPhoneOverride(null);
    setIsEditingPhone(false);

    messageTemplateService.loadTemplates(teacherId).then(res => {
      if (!isMounted) return;
      setTemplatesData(res);
      setLoading(false);
    }).catch(err => {
      console.warn("Failed to load message templates:", err);
      if (isMounted) {
        setTemplatesData({
          templates: messageTemplateService.getFactoryDefaults(),
          meta: {}
        });
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, teacherId, initialTemplateKey]);

  // Compute variables for this student
  const activePhone = phoneOverride !== null ? phoneOverride : (student?.contact_number || '');
  const activeDate = defaultDate ? formatDisplayDate(defaultDate) : formatDisplayDate(new Date());
  const className = cls ? `${cls.name || ''} ${cls.section || ''}`.trim() : (student?.class_name || '');
  const displayName = formatStudentDisplayName(student?.name);

  // When templates or templateKey changes, re-render default message
  useEffect(() => {
    if (!templatesData || !student) return;

    const currentTemplate = templatesData.templates[templateKey] || FACTORY_TEMPLATES[templateKey]?.template || '';
    const rendered = messageTemplateService.renderMessage(templateKey, {
      student_name: student.name,
      class_name: className,
      roll_no: student.roll_no || 'N/A',
      date: activeDate,
      teacher_name: teacherName || 'Class Teacher',
      custom_text: ''
    }, currentTemplate);

    setRenderedMessage(rendered);
  }, [templateKey, templatesData, student, className, activeDate, teacherName]);

  if (!isOpen || !student) return null;

  const currentMeta = templatesData?.meta?.[templateKey];
  const isCustomTeacher = currentMeta?.isCustom;

  // Insert placeholder at cursor position
  const handleInsertPlaceholder = (token) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = renderedMessage;
    const nextText = text.substring(0, start) + token + text.substring(end);
    setRenderedMessage(nextText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(renderedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open WhatsApp
  const handleOpenWhatsApp = () => {
    if (!activePhone) {
      alert("Please enter a valid phone number before opening WhatsApp.");
      setIsEditingPhone(true);
      setPhoneInput('');
      return;
    }

    const url = messageTemplateService.generateWhatsAppUrl(activePhone, renderedMessage);
    if (!url) {
      alert("Invalid phone number format. Please provide a valid 10-digit number.");
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  // Reset to current template default
  const handleResetToTemplate = () => {
    if (!templatesData) return;
    const currentTemplate = templatesData.templates[templateKey] || FACTORY_TEMPLATES[templateKey]?.template || '';
    const rendered = messageTemplateService.renderMessage(templateKey, {
      student_name: student.name,
      class_name: className,
      roll_no: student.roll_no || 'N/A',
      date: activeDate,
      teacher_name: teacherName || 'Class Teacher',
      custom_text: ''
    }, currentTemplate);
    setRenderedMessage(rendered);
  };

  // Save current text as teacher's default for this template
  // To avoid saving specific student names into the template, replace the student's name back with {student_name}
  const handleSaveAsTeacherDefault = async () => {
    if (!teacherId) {
      alert("Only logged-in teachers can save personal template defaults.");
      return;
    }

    setSavingTemplate(true);
    try {
      // Intelligently parameterize current student values back into placeholders
      let generalizedTemplate = renderedMessage;
      if (displayName) {
        generalizedTemplate = generalizedTemplate.replaceAll(displayName, '{student_name}');
      }
      if (className) {
        generalizedTemplate = generalizedTemplate.replaceAll(className, '{class_name}');
      }
      if (student.roll_no) {
        generalizedTemplate = generalizedTemplate.replaceAll(String(student.roll_no), '{roll_no}');
      }
      if (activeDate) {
        generalizedTemplate = generalizedTemplate.replaceAll(activeDate, '{date}');
      }

      await messageTemplateService.saveTeacherTemplates(teacherId, {
        [templateKey]: generalizedTemplate
      });

      // Reload
      const fresh = await messageTemplateService.loadTemplates(teacherId);
      setTemplatesData(fresh);
      setSaveFeedback("Saved as your custom default for this template!");
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (err) {
      alert("Error saving template: " + err.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  // Save phone number edit
  const handleSavePhone = async () => {
    if (!phoneInput) return;
    setSavingPhone(true);
    try {
      const res = await updateStudentContactNumber(student.id, phoneInput);
      if (res?.success) {
        setPhoneOverride(phoneInput);
        setIsEditingPhone(false);
      } else {
        alert("Failed to save phone number: " + (res?.error?.message || 'Please check format'));
      }
    } catch (err) {
      alert("Error updating phone: " + err.message);
    } finally {
      setSavingPhone(false);
    }
  };

  const templateOptions = [
    { key: 'absentee_alert', label: 'Absentee Alert', icon: '🚨' },
    { key: 'general_notice', label: 'General Notice', icon: '💬' },
    { key: 'fee_reminder', label: 'Fee Reminder', icon: '💳' }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-4 text-slate-900 dark:text-white max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight flex items-center gap-2">
                  WhatsApp Message Composer
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Review or edit message before sending via WhatsApp
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 overflow-y-auto flex-1 text-sm">
            {/* Recipient Information Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-300 dark:border-slate-600 shrink-0 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-sm">
                  {student.picture_url ? (
                    <img src={student.picture_url} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-2">
                    <span>{displayName}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                      Roll {student.roll_no || 'N/A'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>Class {className || 'N/A'}</span>
                    {student.father_name && <span>• Guardian: {student.father_name}</span>}
                  </div>
                </div>
              </div>

              {/* Phone info / quick edit */}
              <div className="text-right shrink-0">
                {isEditingPhone ? (
                  <div className="flex items-center gap-1">
                    <input 
                      type="tel" 
                      value={phoneInput} 
                      onChange={(e) => setPhoneInput(e.target.value)} 
                      placeholder="10-digit number"
                      className="px-2 py-1 text-xs border rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 w-32 focus:outline-none focus:border-brand-500"
                      autoFocus
                    />
                    <button 
                      onClick={handleSavePhone} 
                      disabled={savingPhone}
                      className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                      title="Save Number"
                    >
                      <Check size={13} />
                    </button>
                    <button 
                      onClick={() => setIsEditingPhone(false)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {activePhone ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800">
                        <Phone size={11} /> {activePhone}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400 italic">
                        No phone recorded
                      </span>
                    )}
                    <button 
                      onClick={() => {
                        setPhoneInput(activePhone || '');
                        setIsEditingPhone(true);
                      }}
                      className="p-1 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                      title="Edit phone number"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Template Selector Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Select Message Template:
              </label>
              
              <div className="flex items-center gap-1.5 flex-wrap">
                {templateOptions.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setTemplateKey(opt.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      templateKey === opt.key 
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Template Status / Meta */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isCustomTeacher ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                <span>
                  Source: <strong className="text-slate-700 dark:text-slate-200">{isCustomTeacher ? 'Your Custom Override' : 'School Default'}</strong>
                </span>
              </div>
              <button 
                onClick={handleResetToTemplate}
                className="text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                title="Discard manual edits and reload template text"
              >
                <RefreshCw size={10} /> Reset message to template
              </button>
            </div>

            {/* Editable Text Area */}
            <div className="space-y-1.5">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  rows={7}
                  value={renderedMessage}
                  onChange={(e) => setRenderedMessage(e.target.value)}
                  className="w-full p-3.5 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent leading-relaxed"
                  placeholder="Type or customize your WhatsApp message..."
                />
              </div>

              {/* Character Count & Notice */}
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <Info size={12} />
                  <span>Edits made here apply to this send only.</span>
                </div>
                <span>{renderedMessage.length} characters</span>
              </div>
            </div>

            {/* Dynamic Placeholder Insertion Chips */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Quick Insert Dynamic Tags:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { tag: '{student_name}', label: '+ Student Name' },
                  { tag: '{class_name}', label: '+ Class' },
                  { tag: '{roll_no}', label: '+ Roll No' },
                  { tag: '{date}', label: '+ Date' },
                  { tag: '{teacher_name}', label: '+ Teacher' },
                  { tag: '{school_name}', label: '+ School Name' }
                ].map((chip) => (
                  <button
                    key={chip.tag}
                    type="button"
                    onClick={() => handleInsertPlaceholder(chip.tag)}
                    className="px-2.5 py-1 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Save as Teacher Default Option */}
            {teacherId && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Want to use this phrasing for all your students?
                </div>
                <button
                  type="button"
                  onClick={handleSaveAsTeacherDefault}
                  disabled={savingTemplate}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Save size={13} />
                  <span>{savingTemplate ? 'Saving...' : 'Save as My Default'}</span>
                </button>
              </div>
            )}

            {saveFeedback && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs flex items-center gap-2">
                <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{saveFeedback}</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3 shrink-0">
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Copy message to clipboard"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleOpenWhatsApp}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-emerald-600/20 active:scale-95"
              >
                <Send size={14} />
                <span>Open in WhatsApp</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default WhatsAppComposerModal;
