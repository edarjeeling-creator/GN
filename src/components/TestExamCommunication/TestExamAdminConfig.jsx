import { useState, useEffect } from 'react';
import { Save, CheckCircle2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PREDEFINED_COMMUNICATION_TYPES } from '../../services/TestExamCommunicationService';

export default function TestExamAdminConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [analytics, setAnalytics] = useState({
    totalSent: 0,
    studentsReached: 0,
    totalRead: 0,
    totalAck: 0
  });

  const [config, setConfig] = useState({
    max_attachment_size_mb: 10,
    allowed_file_types: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
    whatsapp_notification_enabled: true,
    fcm_push_enabled: true,
    allow_teacher_date_changes: true,
    urgent_priority_roles: ['admin', 'principal', 'coordinator']
  });

  useEffect(() => {
    let ignore = false;
    async function init() {
      setLoading(true);
      try {
        // 1. Fetch app_settings
        const { data: sData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'test_exam_communication_config')
          .maybeSingle();

        if (!ignore && sData?.value) {
          setConfig(prev => ({ ...prev, ...sData.value }));
        }

        // 2. Fetch summary analytics
        const { data: comms } = await supabase
          .from('test_exam_communications')
          .select('recipient_count, read_count, acknowledgement_count')
          .eq('status', 'PUBLISHED');

        if (!ignore && comms) {
          const totalSent = comms.length;
          const studentsReached = comms.reduce((sum, c) => sum + (c.recipient_count || 0), 0);
          const totalRead = comms.reduce((sum, c) => sum + (c.read_count || 0), 0);
          const totalAck = comms.reduce((sum, c) => sum + (c.acknowledgement_count || 0), 0);
          setAnalytics({ totalSent, studentsReached, totalRead, totalAck });
        }
      } catch (err) {
        if (!ignore) console.error('Error loading test/exam comm config:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'test_exam_communication_config',
          value: config,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) throw error;
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert('Error saving configuration: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 text-slate-400 flex items-center justify-center gap-3">
        <RefreshCw className="animate-spin text-brand-400" size={20} />
        <span className="text-xs">Loading communication settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notices Published</div>
          <div className="text-xl font-black text-white mt-1">{analytics.totalSent}</div>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Students Reached</div>
          <div className="text-xl font-black text-brand-400 mt-1">{analytics.studentsReached}</div>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Reads</div>
          <div className="text-xl font-black text-emerald-400 mt-1">{analytics.totalRead}</div>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Acknowledgements</div>
          <div className="text-xl font-black text-purple-400 mt-1">{analytics.totalAck}</div>
        </div>
      </div>

      {/* Main Config Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-black text-white">Test & Examination Communication Policies</h3>
            <p className="text-xs text-slate-400">Control system-wide attachment sizes, allowed file extensions, and notifications.</p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-white font-black text-xs rounded-xl shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{saving ? 'Saving...' : 'Save Policies'}</span>
          </button>
        </div>

        {savedSuccess && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-emerald-300 text-xs font-bold">
            <CheckCircle2 size={16} />
            <span>Settings successfully updated!</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          {/* Maximum attachment size */}
          <div className="space-y-2">
            <label className="block font-bold text-slate-300 uppercase tracking-wider">
              Maximum Attachment Size (MB)
            </label>
            <input
              type="number"
              value={config.max_attachment_size_mb}
              onChange={(e) => setConfig({ ...config, max_attachment_size_mb: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-medium focus:border-brand-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500">School ERP standard is 10MB per uploaded file.</p>
          </div>

          {/* Allowed File Types */}
          <div className="space-y-2">
            <label className="block font-bold text-slate-300 uppercase tracking-wider">
              Allowed File Extensions
            </label>
            <input
              type="text"
              value={config.allowed_file_types?.join(', ')}
              onChange={(e) => setConfig({ ...config, allowed_file_types: e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-medium focus:border-brand-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500">Comma-separated: pdf, jpg, jpeg, png, doc, docx</p>
          </div>

          {/* WhatsApp & Push toggles */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.whatsapp_notification_enabled}
                onChange={(e) => setConfig({ ...config, whatsapp_notification_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-brand-500 bg-slate-950 border-slate-800"
              />
              <span className="text-slate-300 font-bold">Enable 1-Tap WhatsApp Summary Sharing</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.fcm_push_enabled}
                onChange={(e) => setConfig({ ...config, fcm_push_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-brand-500 bg-slate-950 border-slate-800"
              />
              <span className="text-slate-300 font-bold">Dispatch Mobile FCM Push Alerts</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.allow_teacher_date_changes}
                onChange={(e) => setConfig({ ...config, allow_teacher_date_changes: e.target.checked })}
                className="w-4 h-4 rounded text-brand-500 bg-slate-950 border-slate-800"
              />
              <span className="text-slate-300 font-bold">Allow Teachers to Postpone / Change Test Dates</span>
            </label>
          </div>

          {/* Predefined Types Reference */}
          <div className="space-y-2">
            <label className="block font-bold text-slate-300 uppercase tracking-wider">
              Active Predefined Types ({PREDEFINED_COMMUNICATION_TYPES.length})
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-slate-950 rounded-xl border border-slate-800">
              {PREDEFINED_COMMUNICATION_TYPES.map(t => (
                <span key={t.id} className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300">
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
