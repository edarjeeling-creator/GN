import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle, Shield, Users, MessageSquare, Copy, Check, 
  ExternalLink, AlertTriangle, Send, Phone, ArrowRight, Edit2,
  Sliders, Sparkles, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../context/DataContext';
import { formatStudentDisplayName, formatDisplayDate } from '../utils/studentUtils';
import { messageTemplateService, FACTORY_TEMPLATES } from '../services/MessageTemplateService';
import WhatsAppComposerModal from './WhatsAppComposerModal';

const AbsenteeNotificationModal = ({ isOpen, onClose, data }) => {
  const { updateStudentContactNumber } = useData();
  const [copiedId, setCopiedId] = useState(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [editingPhoneId, setEditingPhoneId] = useState(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [savingPhoneId, setSavingPhoneId] = useState(null);
  const [localPhoneOverrides, setLocalPhoneOverrides] = useState({});

  // Template customization within modal
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [customTemplate, setCustomTemplate] = useState('');
  const [activeComposerStudent, setActiveComposerStudent] = useState(null);

  useEffect(() => {
    if (isOpen && data) {
      messageTemplateService.loadTemplates(data?.teacherId).then(res => {
        setCustomTemplate(res.templates?.absentee_alert || FACTORY_TEMPLATES.absentee_alert.template);
      }).catch(() => {
        setCustomTemplate(FACTORY_TEMPLATES.absentee_alert.template);
      });
    }
  }, [isOpen, data]);

  if (!isOpen || !data) return null;

  const {
    totalAbsent = 0,
    className = '',
    date = '',
    principalNotified = false,
    parentNotificationsCount = 0,
    studentAlerts = [],
    classSummaryText = '',
    principalProfiles = []
  } = data;

  const handleCopyIndividual = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(classSummaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const principalWithPhone = principalProfiles.find(p => p.contact_number);
  const principalWhatsAppUrl = principalWithPhone
    ? messageTemplateService.generateWhatsAppUrl(principalWithPhone.contact_number, classSummaryText)
    : null;

  const handleStartEditPhone = (studentId, currentNumber) => {
    setEditingPhoneId(studentId);
    setPhoneInput(currentNumber || '');
  };

  const handleCancelEditPhone = () => {
    setEditingPhoneId(null);
    setPhoneInput('');
  };

  const handleSavePhone = async (studentId) => {
    setSavingPhoneId(studentId);
    try {
      const res = await updateStudentContactNumber(studentId, phoneInput);
      if (res?.success) {
        setLocalPhoneOverrides(prev => ({ ...prev, [studentId]: phoneInput }));
        setEditingPhoneId(null);
      } else {
        alert("Failed to update phone number: " + (res?.error?.message || "Please try again"));
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSavingPhoneId(null);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col my-8 text-white max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  Absentee Notifications Dispatched
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    {totalAbsent} Absent
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Class: <strong className="text-slate-200">{className}</strong> • Date: <strong className="text-slate-200">{date}</strong>
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
            
            {/* Status Summary Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Principal Status Card */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                  <Shield size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
                    <CheckCircle size={15} /> Principal Alerted
                  </div>
                  <p className="text-xs text-emerald-400/80 mt-0.5">
                    Real-time in-app and push notification delivered to Principal's portal.
                  </p>
                </div>
              </div>

              {/* Parent Status Card */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
                  <Users size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-300">
                    <CheckCircle size={15} /> Parent In-App Dispatched
                  </div>
                  <p className="text-xs text-blue-400/80 mt-0.5">
                    Absence notice sent to student & parent portal accounts ({parentNotificationsCount} profile links).
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Broadcast Toolbar */}
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Parent Direct Communication</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Send individual WhatsApp messages below or broadcast the summary to your class group.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    isEditingTemplate
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                  }`}
                  title="Customize message template for today's dispatches"
                >
                  <Sliders size={13} />
                  <span>{isEditingTemplate ? 'Hide Template' : 'Customize Message'}</span>
                </button>

                <button
                  onClick={handleCopySummary}
                  className="px-3.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Copy formatted bulletin for WhatsApp Class Group"
                >
                  {copiedSummary ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copiedSummary ? 'Copied Summary!' : 'Copy Class Summary'}
                </button>

                {principalWhatsAppUrl && (
                  <a
                    href={principalWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Send size={14} /> Send to Principal (WhatsApp)
                  </a>
                )}
              </div>
            </div>

            {/* Optional Inline Template Customizer */}
            {isEditingTemplate && (
              <div className="p-4 rounded-xl bg-slate-800/90 border border-indigo-500/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Customize Today's Absentee Template
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomTemplate(FACTORY_TEMPLATES.absentee_alert.template)}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <RefreshCw size={11} /> Reset to Default
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={customTemplate}
                  onChange={(e) => setCustomTemplate(e.target.value)}
                  className="w-full p-3 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Template with {student_name}, {class_name}, etc..."
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Edits dynamically update all student WhatsApp messages below.</span>
                  <span>{customTemplate.length} chars</span>
                </div>
              </div>
            )}

            {/* Student List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Absent Students ({studentAlerts.length})
              </h4>

              <div className="space-y-2">
                {studentAlerts.map(item => {
                  const currentPhone = localPhoneOverrides[item.id] !== undefined ? localPhoneOverrides[item.id] : item.contact_number;
                  const cleaned = currentPhone ? String(currentPhone).replace(/\D/g, '') : null;
                  const formattedPhone = cleaned ? (cleaned.length === 10 ? `91${cleaned}` : (cleaned.length === 12 && cleaned.startsWith('91') ? cleaned : cleaned)) : null;

                  const effectiveMessage = customTemplate 
                    ? messageTemplateService.renderMessage('absentee_alert', {
                        student_name: item.name,
                        class_name: className,
                        roll_no: item.roll_no,
                        date: date,
                        teacher_name: data?.teacherName || 'Class Teacher'
                      }, customTemplate)
                    : (item.messageText || '');

                  const dynamicWhatsAppUrl = formattedPhone ? messageTemplateService.generateWhatsAppUrl(formattedPhone, effectiveMessage) : null;
                  const isEditingThis = editingPhoneId === item.id;
                  const isSavingThis = savingPhoneId === item.id;

                  return (
                    <div 
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 font-bold text-sm shrink-0">
                          {formatStudentDisplayName(item.name) ? formatStudentDisplayName(item.name).charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                            <span className="truncate">{formatStudentDisplayName(item.name)}</span>
                            <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded shrink-0">
                              Roll No. {item.roll_no || 'N/A'}
                            </span>
                          </div>

                          {isEditingThis ? (
                            <div className="flex items-center gap-1.5 mt-2">
                              <input
                                type="tel"
                                placeholder="10-digit number"
                                value={phoneInput}
                                onChange={(e) => setPhoneInput(e.target.value)}
                                className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-brand-500 w-40"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSavePhone(item.id)}
                                disabled={isSavingThis}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1"
                              >
                                {isSavingThis ? '...' : <Check size={12} />}
                                <span>Save</span>
                              </button>
                              <button
                                onClick={handleCancelEditPhone}
                                className="p-1 text-slate-400 hover:text-white rounded"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                              {item.father_name && <span>Guardian: {item.father_name}</span>}
                              {currentPhone ? (
                                <span className="flex items-center gap-1 text-slate-300 font-medium">
                                  <Phone size={11} className="text-emerald-400" /> {currentPhone}
                                  <button
                                    onClick={() => handleStartEditPhone(item.id, currentPhone)}
                                    className="ml-1 text-[11px] text-brand-400 hover:text-brand-300 underline flex items-center gap-0.5"
                                  >
                                    <Edit2 size={10} /> Change
                                  </button>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5">
                                  <span className="text-amber-400 italic">No phone recorded</span>
                                  <button
                                    onClick={() => handleStartEditPhone(item.id, '')}
                                    className="text-[11px] text-brand-400 hover:text-brand-300 underline"
                                  >
                                    + Add Number
                                  </button>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setActiveComposerStudent({
                            ...item,
                            contact_number: currentPhone
                          })}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                          title="Open Composer to edit message"
                        >
                          <Edit2 size={12} />
                          <span>Compose</span>
                        </button>

                        <button
                          onClick={() => handleCopyIndividual(item.id, effectiveMessage)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                          title="Copy message to clipboard"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check size={13} className="text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        {dynamicWhatsAppUrl ? (
                          <a
                            href={dynamicWhatsAppUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all hover:shadow"
                            title="Open WhatsApp chat with parent"
                          >
                            <MessageSquare size={13} />
                            <span>WhatsApp</span>
                            <ExternalLink size={11} className="opacity-70" />
                          </a>
                        ) : (
                          <button
                            onClick={() => handleStartEditPhone(item.id, '')}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-medium border border-amber-500/30 transition-colors"
                          >
                            + Add Phone
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-800/80 border-t border-slate-700/60 flex items-center justify-between shrink-0">
            <p className="text-xs text-slate-400">
              Absence notices have been logged to the system audit trail.
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>

      {activeComposerStudent && (
        <WhatsAppComposerModal
          isOpen={!!activeComposerStudent}
          onClose={() => setActiveComposerStudent(null)}
          student={activeComposerStudent}
          cls={{ name: className }}
          teacherName={data?.teacherName || 'Class Teacher'}
          teacherId={data?.teacherId}
          initialTemplateKey="absentee_alert"
          defaultDate={date}
        />
      )}
    </AnimatePresence>
  );
};

export default AbsenteeNotificationModal;
