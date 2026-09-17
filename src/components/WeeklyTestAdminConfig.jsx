import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { WeeklyTestReportService, DEFAULT_WEEKLY_TEST_CONFIG } from '../services/WeeklyTestReportService';
import { 
  Save, Trophy, CheckCircle, 
  MessageSquare, RotateCcw 
} from 'lucide-react';

export default function WeeklyTestAdminConfig() {
  const { profile } = useAuth();
  const { classes } = useData();
  const [config, setConfig] = useState(DEFAULT_WEEKLY_TEST_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Extract unique class names from existing ERP database
  const availableClassNames = useMemo(() => {
    const names = new Set();
    (classes || []).forEach(c => {
      if (c.name) names.add(c.name.trim());
    });
    // Ensure default Senior School classes exist in options
    ['Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].forEach(c => names.add(c));
    return Array.from(names).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });
  }, [classes]);



  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const data = await WeeklyTestReportService.getConfig();
        if (!ignore) setConfig(data);
      } catch (err) {
        console.error('Error loading config:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    init();
    return () => { ignore = true; };
  }, []);

  const handleToggleClass = (clsName) => {
    const current = config.applicable_classes || [];
    let updated;
    if (current.includes(clsName)) {
      updated = current.filter(c => c !== clsName);
    } else {
      updated = [...current, clsName];
    }
    setConfig(prev => ({ ...prev, applicable_classes: updated }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus('');
    try {
      await WeeklyTestReportService.saveConfig(config, profile);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      console.error('Error saving weekly test config:', err);
      setSaveStatus('error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all Weekly Test settings to default school baseline?')) {
      setConfig({ ...DEFAULT_WEEKLY_TEST_CONFIG });
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-400">Loading Configuration...</div>;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 max-w-4xl mx-auto shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="text-amber-500" size={22} />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Weekly Test & Tuesday Assembly Honours Configuration
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure authoritative ranking policies, Senior School class scope, attention thresholds, and Monday generation rules.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw size={14} /> Reset Defaults
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Applicable Classes */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Applicable Senior School Classes (Report Scope)
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select the classes included in the consolidated report. By default, Senior School encompasses Classes 5 to 12.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {availableClassNames.map(clsName => {
              const isChecked = (config.applicable_classes || []).includes(clsName);
              return (
                <label
                  key={clsName}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition ${
                    isChecked
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleClass(clsName)}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                  />
                  <span>{clsName}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 2. Ranking & Tie Handling Policy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Top 3 Ranking & Tie Policy
            </label>
            <select
              value={config.ranking_policy || 'DENSE'}
              onChange={e => setConfig({ ...config, ranking_policy: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold"
            >
              <option value="DENSE">Dense Ranking (1, 1, 2) — Standard GN Honours</option>
              <option value="COMPETITION">Standard Competition Ranking (1, 1, 3)</option>
              <option value="SHARED">Shared Position Labeling (1st (Tie), 2nd)</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Dense ranking gives tied students identical ranks without skipping subsequent positions.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Coordinator Workflow Mode
            </label>
            <select
              value={config.coordinator_review_mode || 'EXEMPT'}
              onChange={e => setConfig({ ...config, coordinator_review_mode: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold"
            >
              <option value="EXEMPT">Exempt: Teacher submission is immediately report-eligible</option>
              <option value="REQUIRED">Required: Weekly tests require Coordinator verification & approval</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Configure whether weekly test marks undergo the full Coordinator approval state machine before inclusion.
            </p>
          </div>
        </div>

        {/* 3. Requires Attention Threshold */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Requires Attention Threshold
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={config.requires_attention_threshold ?? 10}
                onChange={e => setConfig({ ...config, requires_attention_threshold: Number(e.target.value) })}
                className="w-28 h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold text-center"
              />
              <select
                value={config.threshold_type || 'SCORE'}
                onChange={e => setConfig({ ...config, threshold_type: e.target.value })}
                className="flex-1 h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold"
              >
                <option value="SCORE">Raw Score (Default: Below 10)</option>
                <option value="PERCENTAGE">Percentage (% of max marks)</option>
              </select>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Students scoring below this threshold are automatically flagged for principal review.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Exclusion Rules
            </label>
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.exclude_absent_from_ranking !== false}
                  onChange={e => setConfig({ ...config, exclude_absent_from_ranking: e.target.checked })}
                  className="rounded text-brand-600"
                />
                <span>Exclude absent students from ranking calculations</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.exclude_na_from_ranking !== false}
                  onChange={e => setConfig({ ...config, exclude_na_from_ranking: e.target.checked })}
                  className="rounded text-brand-600"
                />
                <span>Exclude N/A students from ranking calculations</span>
              </label>
            </div>
          </div>
        </div>

        {/* 4. Monday Schedule & Branding */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Official Report Schedule
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                disabled
                value="Monday Morning"
                className="w-1/2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold"
              />
              <input
                type="time"
                value={config.report_generation_time || '08:00'}
                onChange={e => setConfig({ ...config, report_generation_time: e.target.value })}
                className="w-1/2 h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold text-center"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Consolidated report is verified and finalized for Tuesday Assembly.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              School Report Title
            </label>
            <input
              type="text"
              value={config.school_branding?.report_title || 'WEEKLY TEST REPORT'}
              onChange={e => setConfig({
                ...config,
                school_branding: { ...(config.school_branding || {}), report_title: e.target.value }
              })}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold"
            />
          </div>
        </div>

        {/* 5. WhatsApp Alert Template */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
            <MessageSquare size={14} className="text-emerald-500" />
            <span>WhatsApp Notification Message Template (Short & Uncluttered)</span>
          </label>
          <textarea
            rows={3}
            value={config.whatsapp_message_template || ''}
            onChange={e => setConfig({ ...config, whatsapp_message_template: e.target.value })}
            className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono"
            placeholder="Template variables: {{week}}, {{date}}, {{version}}"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Sends a single alert directing the Principal to the ERP rather than flooding WhatsApp with individual class marks.
          </p>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            {saveStatus === 'success' && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle size={15} /> Settings saved successfully!
              </span>
            )}
            {saveStatus.startsWith('error') && (
              <span className="text-xs font-bold text-rose-600">
                {saveStatus}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-hero-primary flex items-center gap-2 text-xs py-2.5 px-6 font-bold cursor-pointer disabled:opacity-50"
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
