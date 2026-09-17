import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  Trophy, Download, RefreshCw, AlertTriangle, 
  Send, Calendar, ShieldAlert
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { WeeklyTestReportService } from '../services/WeeklyTestReportService';
import WeeklyTestConsolidatedPDF from './WeeklyTestConsolidatedPDF';

export default function WeeklyTestReportViewer({ academicYear = '2026' }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [archive, setArchive] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [completionData, setCompletionData] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);
  const pdfContainerRef = useRef(null);

  const isPrincipalOrAdmin = ['admin', 'superadmin', 'principal', 'coordinator'].includes(profile?.role);

  // Load latest report and archive
  const loadReports = useCallback(async (targetId = null) => {
    try {
      const arch = await WeeklyTestReportService.getReportArchive(academicYear);
      setArchive(arch);

      let target = null;
      if (targetId) {
        const { data } = await supabase
          .from('weekly_test_reports')
          .select('*')
          .eq('id', targetId)
          .maybeSingle();
        target = data;
      } else if (arch.length > 0) {
        const { data } = await supabase
          .from('weekly_test_reports')
          .select('*')
          .eq('id', arch[0].id)
          .maybeSingle();
        target = data;
      }

      setReport(target);
      if (target) {
        setSelectedReportId(target.id);
      }

      // Also fetch cycle completion status
      const completion = await WeeklyTestReportService.getCycleCompletionStatus({
        academicYear,
        testDate: target?.test_date || new Date().toISOString().split('T')[0]
      });
      setCompletionData(completion);
    } catch (err) {
      console.error('Error loading report viewer:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [academicYear]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const arch = await WeeklyTestReportService.getReportArchive(academicYear);
        if (ignore) return;
        setArchive(arch);

        let target = null;
        if (arch.length > 0) {
          const { data } = await supabase
            .from('weekly_test_reports')
            .select('*')
            .eq('id', arch[0].id)
            .maybeSingle();
          if (!ignore) target = data;
        }

        if (!ignore) {
          setReport(target);
          if (target) {
            setSelectedReportId(target.id);
          }
        }

        const completion = await WeeklyTestReportService.getCycleCompletionStatus({
          academicYear,
          testDate: target?.test_date || new Date().toISOString().split('T')[0]
        });
        if (!ignore) setCompletionData(completion);
      } catch (err) {
        console.error('Error loading report viewer:', err);
      } finally {
        if (!ignore) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    }
    init();
    return () => { ignore = true; };
  }, [academicYear]);

  // Handle report selection from archive
  const handleSelectReport = async (reportId) => {
    if (!reportId || reportId === selectedReportId) return;
    setSelectedReportId(reportId);
    await loadReports(reportId);
  };

  // Run Monday check or trigger update
  const handleRunReportCheck = async (forceRevision = false) => {
    setIsRefreshing(true);
    try {
      const updated = await WeeklyTestReportService.generateConsolidatedReport({
        cycleId: report?.cycle_id,
        academicYear,
        forceRevision,
        revisionReason: forceRevision ? `Triggered by ${profile?.name || 'Principal'}` : '',
        generatedBy: profile?.id
      });
      await loadReports(updated.id);
    } catch (err) {
      alert('Error updating report: ' + err.message);
      setIsRefreshing(false);
    }
  };

  // Generate and Download Official PDF from Immutable Snapshot
  const handleDownloadPdf = async () => {
    if (!report || !pdfContainerRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: report.pdf_filename || `Weekly_Test_Report_${report.week_identifier}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(pdfContainerRef.current).save();
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Could not download PDF: ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // WhatsApp Alert to Principal (Concise secondary action, NO flooding)
  const handleSendWhatsAppNotification = () => {
    if (!report) return;
    const text = WeeklyTestReportService.generateWhatsAppNotificationText(report);
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleCopyWhatsAppText = () => {
    if (!report) return;
    const text = WeeklyTestReportService.generateWhatsAppNotificationText(report);
    navigator.clipboard.writeText(text);
    setCopiedWhatsapp(true);
    setTimeout(() => setCopiedWhatsapp(false), 2500);
  };

  if (loading && !report) {
    return (
      <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 flex items-center justify-center gap-3">
        <RefreshCw className="animate-spin text-brand-400" size={22} />
        <span>Loading Weekly Test Report...</span>
      </div>
    );
  }

  const summary = report?.summary_data || {};
  const honours = report?.honours_data || [];
  const requiresAttention = report?.requires_attention_data || [];
  const missing = report?.missing_submissions_data || completionData?.missingSubmissions || [];
  const isFinal = report?.status === 'FINAL';

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* 1. TOP MOBILE COMMAND HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Tuesday Assembly
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                isFinal 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {isFinal ? '🟢 FINAL REPORT' : '🟡 PENDING / INCOMPLETE'}
              </span>
              {report?.version > 1 && (
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold">
                  Version V{report.version} (Revised)
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              Senior School Weekly Test Report
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {report?.week_identifier} • Test Date: <strong className="text-slate-200">{report?.test_date}</strong> • Classes 5–12
            </p>
          </div>

          {/* Quick 1-Tap Primary Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {report && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingPdf ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    <span>Preparing Official PDF...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Open Report PDF</span>
                  </>
                )}
              </button>
            )}

            {/* Refresh / Monday Scheduled Check */}
            {isPrincipalOrAdmin && (
              <button
                type="button"
                onClick={() => handleRunReportCheck(false)}
                disabled={isRefreshing}
                title="Refresh completion status"
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={isRefreshing ? 'animate-spin' : ''} size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Report Archive & Selector Bar */}
        <div className="mt-3 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-400" />
            <span className="font-semibold">Archive:</span>
            <select
              value={selectedReportId || ''}
              onChange={e => handleSelectReport(e.target.value)}
              className="bg-slate-950 text-white font-medium px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {archive.map(a => (
                <option key={a.id} value={a.id}>
                  {a.week_identifier} ({a.test_date}) — V{a.version} [{a.status}]
                </option>
              ))}
            </select>
          </div>

          {/* Secondary WhatsApp action */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSendWhatsAppNotification}
              className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-800/60 rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
              title="Share short notification with Principal on WhatsApp"
            >
              <Send size={12} />
              <span>WhatsApp Alert</span>
            </button>
            <button
              type="button"
              onClick={handleCopyWhatsAppText}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium transition"
            >
              {copiedWhatsapp ? 'Copied!' : 'Copy Msg'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. PENDING / MISSING SUBMISSIONS WARNING BANNER */}
      {!isFinal && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-2xl p-4 text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-amber-300">
                  Weekly Test Report Pending — Incomplete Marks
                </h4>
                <button
                  type="button"
                  onClick={() => setShowMissingModal(!showMissingModal)}
                  className="text-xs text-amber-400 underline font-semibold cursor-pointer"
                >
                  {showMissingModal ? 'Hide Incomplete Details' : `View ${missing.length} Incomplete Entries`}
                </button>
              </div>
              <p className="text-xs text-amber-300/80 mt-1">
                The official consolidated report cannot be marked FINAL until all required Senior School subject marks are submitted.
              </p>

              {showMissingModal && (
                <div className="mt-3 bg-slate-950/80 rounded-xl p-3 border border-amber-900/50 max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="text-[10px] uppercase text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="pb-1">Class</th>
                        <th className="pb-1">Subject</th>
                        <th className="pb-1">Teacher</th>
                        <th className="pb-1 text-center">Entered</th>
                        <th className="pb-1 text-center">Pending</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {missing.map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/50">
                          <td className="py-1 font-bold text-white">{m.className} {m.section}</td>
                          <td className="py-1">{m.subjectName}</td>
                          <td className="py-1 text-slate-400">{m.teacherName}</td>
                          <td className="py-1 text-center text-emerald-400 font-mono">{m.enteredCount}</td>
                          <td className="py-1 text-center text-rose-400 font-mono font-bold">{m.pendingCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. EXECUTIVE SUMMARY METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Classes</span>
          <span className="text-lg font-black text-white">
            {summary.completedClasses || 0} / {summary.totalClasses || 8}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Subjects</span>
          <span className="text-lg font-black text-white">
            {summary.completedSubjects || 0} / {summary.totalSubjects || 0}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Evaluated</span>
          <span className="text-lg font-black text-emerald-400">
            {summary.studentsEvaluated || 0}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Absentees</span>
          <span className="text-lg font-black text-amber-400">
            {summary.studentsAbsent || 0}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Attention</span>
          <span className="text-lg font-black text-rose-400">
            {summary.studentsRequiringAttention || 0}
          </span>
        </div>
      </div>

      {/* 4. TUESDAY ASSEMBLY HONOURS PODIUM (High-Contrast, Instant Scan) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="text-amber-400" size={20} />
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              Tuesday Assembly Honours Summary
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Classes 5–12 Top Scorers</span>
        </div>

        {honours.length === 0 ? (
          <p className="text-slate-400 text-center py-6 italic text-xs">
            No honours available yet. Awaiting test mark entries.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {honours.map(clsH => (
              <div 
                key={clsH.classId}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 hover:border-slate-700 transition"
              >
                <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
                  <h4 className="font-black text-sm text-white">{clsH.fullClassName}</h4>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Top 3 Rankers</span>
                </div>

                {clsH.topScorers.length === 0 ? (
                  <span className="text-slate-500 italic text-xs block py-1">No marks entered</span>
                ) : (
                  <ul className="space-y-1.5">
                    {clsH.topScorers.map(s => {
                      const medal = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : '🥉';
                      const medalColor = s.rank === 1 ? 'text-amber-400' : s.rank === 2 ? 'text-slate-300' : 'text-amber-600';
                      return (
                        <li key={s.studentId} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`text-base ${medalColor}`}>{medal}</span>
                            <div>
                              <strong className="text-white font-bold">{s.name}</strong>
                              {s.house && <span className="text-slate-400 text-[10px] ml-1.5">({s.house})</span>}
                            </div>
                          </div>
                          <div className="font-mono text-right">
                            <span className="font-bold text-slate-200">{s.total}</span>
                            <span className="text-slate-400 text-[10px] ml-1">({s.percentage}%)</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. REQUIRES ATTENTION SECTION */}
      {requiresAttention.length > 0 && (
        <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between pb-2.5 border-b border-rose-900/40 mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="text-rose-400" size={18} />
              <h3 className="text-sm font-black text-rose-300 uppercase tracking-wider">
                Students Requiring Academic Attention
              </h3>
            </div>
            <span className="text-[10px] font-bold text-rose-400 uppercase bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
              Below Threshold ({report.config_snapshot?.requires_attention_threshold || 10})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {requiresAttention.flatMap(c => c.students.map(st => (
              <div 
                key={`${c.classId}_${st.studentId}`} 
                className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-rose-950 text-xs"
              >
                <div>
                  <strong className="text-rose-200">{c.fullClassName}:</strong>
                  <span className="text-slate-200 ml-1.5 font-medium">{st.name}</span>
                  {st.house && <span className="text-slate-400 text-[10px] ml-1">({st.house})</span>}
                </div>
                <span className="font-mono font-bold text-rose-400">
                  {st.total} / {st.maxMarks} ({st.percentage}%)
                </span>
              </div>
            )))}
          </div>
        </div>
      )}

      {/* 6. HIDDEN PRINTABLE / PDF TEMPLATE (Rendered strictly from immutable server snapshot) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <WeeklyTestConsolidatedPDF 
          report={report} 
          innerRef={pdfContainerRef}
        />
      </div>
    </div>
  );
}
