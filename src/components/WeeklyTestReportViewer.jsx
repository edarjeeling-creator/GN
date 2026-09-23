import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  Trophy, Download, RefreshCw, AlertTriangle, 
  Send, Calendar, ShieldAlert, BookOpen, FileText, 
  Printer, Search, X
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { WeeklyTestReportService } from '../services/WeeklyTestReportService';
import WeeklyTestConsolidatedPDF from './WeeklyTestConsolidatedPDF';
import { getStudentHouse } from '../utils/houseData';
import { formatStudentDisplayName } from '../utils/studentUtils';

export default function WeeklyTestReportViewer({ academicYear = '2026', initialTerm = 'Finalterm' }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [archive, setArchive] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [completionData, setCompletionData] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(initialTerm);
  const [isCompiling, setIsCompiling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);
  const [honoursViewMode, setHonoursViewMode] = useState('class'); // 'class' | 'subject' | 'all_marksheets'
  const pdfContainerRef = useRef(null);

  // Marksheet Tab States
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [marksheetSearch, setMarksheetSearch] = useState('');

  // Interactive Student Marks Modal State
  const [activeMarksModal, setActiveMarksModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalStudents, setModalStudents] = useState([]);
  const [modalSearch, setModalSearch] = useState('');

  const isPrincipalOrAdmin = ['admin', 'superadmin', 'principal', 'coordinator'].includes(profile?.role);

  // Load report and archive for selected term
  const loadReports = useCallback(async (targetId = null, forcedTerm = null) => {
    const termToUse = forcedTerm || selectedTerm;
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
        // Find matching term in archive
        const match = arch.find(a => a.summary_data?.term === termToUse || a.term === termToUse) || arch[0];
        const { data } = await supabase
          .from('weekly_test_reports')
          .select('*')
          .eq('id', match.id)
          .maybeSingle();
        target = data;
      }

      // If no persisted report exists in archive, auto-compile live in-memory report from teacher entries
      if (!target) {
        setIsCompiling(true);
        target = await WeeklyTestReportService.generateConsolidatedReport({
          academicYear,
          term: termToUse
        });
      }

      if (target && !target.subject_honours_data && target.summary_data?.subject_honours_data) {
        target.subject_honours_data = target.summary_data.subject_honours_data;
      }

      setReport(target);
      if (target?.id) {
        setSelectedReportId(target.id);
      }

      // Also fetch live cycle completion status with deduplicated precedence
      const completion = await WeeklyTestReportService.getCycleCompletionStatus({
        academicYear,
        term: termToUse,
        testDate: target?.test_date || new Date().toISOString().split('T')[0]
      });
      setCompletionData(completion);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Error loading report viewer:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      setIsCompiling(false);
    }
  }, [academicYear, selectedTerm]);

  useEffect(() => {
    let ignore = false;
    async function initReports() {
      if (!ignore) {
        await loadReports(null, selectedTerm);
      }
    }
    initReports();
    return () => { ignore = true; };
  }, [academicYear, selectedTerm, loadReports]);

  // Handle term change (Finalterm vs Midterm)
  const handleTermChange = (newTerm) => {
    if (newTerm === selectedTerm) return;
    setSelectedTerm(newTerm);
    setLoading(true);
    loadReports(null, newTerm);
  };

  // Handle report selection from archive
  const handleSelectReport = async (reportId) => {
    if (!reportId || reportId === selectedReportId) return;
    setSelectedReportId(reportId);
    await loadReports(reportId, selectedTerm);
  };

  // Force re-compilation of live marks
  const handleRunReportCheck = async (forceCompile = false) => {
    setIsRefreshing(true);
    try {
      if (forceCompile) {
        setIsCompiling(true);
        const compiled = await WeeklyTestReportService.generateConsolidatedReport({
          academicYear,
          term: selectedTerm,
          isMondaySchedule: false,
          generatedBy: profile?.id
        });
        setReport(compiled);
      }
      await loadReports(selectedReportId, selectedTerm);
    } catch (err) {
      console.error('Error recompiling report:', err);
    } finally {
      setIsRefreshing(false);
      setIsCompiling(false);
    }
  };

  // High-Quality PDF Export
  const handleDownloadPdf = async () => {
    if (!report || !pdfContainerRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: report.pdf_filename || `Weekly_Test_Report_${report.week_identifier}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      };

      await html2pdf().set(opt).from(pdfContainerRef.current).save();
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again or use browser print.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // WhatsApp text notification for Principal
  const handleSendWhatsAppNotification = () => {
    if (!report) return;
    const text = WeeklyTestReportService.generateWhatsAppNotificationText(report);
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleCopyWhatsAppText = async () => {
    if (!report) return;
    const text = WeeklyTestReportService.generateWhatsAppNotificationText(report);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWhatsapp(true);
      setTimeout(() => setCopiedWhatsapp(false), 2000);
    } catch (err) {
      console.error('Failed to copy WhatsApp message:', err);
    }
  };

  // Open the interactive student marks modal
  const handleOpenMarksModal = async (data) => {
    setActiveMarksModal(data);
    setModalSearch('');

    if (data.students && data.students.length > 0) {
      setModalStudents(data.students);
      setModalLoading(false);
      return;
    }

    setModalLoading(true);
    try {
      // Fetch students for this class
      const { data: stData } = await supabase
        .from('students')
        .select('id, roll_no, name')
        .eq('class_id', data.classId)
        .order('roll_no', { ascending: true });

      // Fetch marks from weekly_test_marks
      const marksMap = {};
      const { data: testData } = await supabase
        .from('weekly_tests')
        .select('id, max_marks')
        .eq('class_id', data.classId)
        .eq('subject_id', data.subjectId)
        .order('test_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (testData?.id) {
        const { data: mData } = await supabase
          .from('weekly_test_marks')
          .select('*')
          .eq('test_id', testData.id);

        if (mData) {
          mData.forEach(m => {
            marksMap[m.student_id] = { score: m.score, isAbsent: m.is_absent };
          });
        }
      }

      const fullClassName = data.fullClassName || '';
      const maxMarks = data.maxMarks || testData?.max_marks || WeeklyTestReportService.getClassWeeklyTestMaxMarks(fullClassName);
      const passingMarks = data.passingMarks || Math.round(maxMarks * 0.4);

      const resolved = (stData || []).map(s => {
        const entry = marksMap[s.id];
        const isAbsent = Boolean(entry?.isAbsent);
        const score = entry && entry.score !== null && entry.score !== undefined ? entry.score : null;
        const percentage = (!isAbsent && score !== null && maxMarks > 0) ? ((score / maxMarks) * 100).toFixed(1) : null;
        const house = getStudentHouse(s.name, fullClassName);

        let result = 'Pending';
        if (isAbsent) result = 'Absent';
        else if (score !== null) {
          result = score >= passingMarks ? 'Pass' : 'Fail';
        }

        return {
          studentId: s.id,
          rollNo: s.roll_no,
          name: formatStudentDisplayName(s.name),
          house,
          total: score,
          maxMarks,
          percentage,
          isAbsent,
          result
        };
      });

      setModalStudents(resolved);
    } catch (err) {
      console.error('Error fetching marks for modal:', err);
    } finally {
      setModalLoading(false);
    }
  };

  // Print individual class marksheet
  const handlePrintIndividualClass = (cls) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print class marksheets.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${cls.fullClassName} Marksheet - Gyanoday Niketan</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; font-size: 11px; color: #0f172a; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
          .header h1 { margin: 0; font-size: 18px; text-transform: uppercase; }
          .header h2 { margin: 4px 0; font-size: 13px; color: #475569; }
          .meta { display: flex; justify-content: space-between; border: 1px solid #cbd5e1; padding: 8px 12px; margin-bottom: 15px; background: #f8fafc; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
          th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; font-weight: bold; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding: 0 40px; font-weight: 600; font-size: 11px; }
          .sign-box { border-top: 1px solid #64748b; width: 180px; text-align: center; padding-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>GYANODAY NIKETAN</h1>
          <h2>Senior School Weekly Test Official Result Sheet</h2>
          <div>Darjeeling, West Bengal • Academic Year ${academicYear}</div>
        </div>
        <div class="meta">
          <div><strong>Class:</strong> ${cls.fullClassName}</div>
          <div><strong>Scale:</strong> Max ${cls.maxMarks || 25} Marks</div>
          <div><strong>Students Evaluated:</strong> ${cls.roster?.length || 0}</div>
          <div><strong>Date:</strong> ${report?.test_date || new Date().toISOString().split('T')[0]}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th class="text-center" style="width: 40px;">Roll</th>
              <th>Student Name</th>
              <th class="text-center" style="width: 80px;">House</th>
              <th class="text-center" style="width: 90px;">Marks (${cls.maxMarks || 25})</th>
              <th class="text-center" style="width: 60px;">%</th>
              <th class="text-center" style="width: 80px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${(cls.roster || []).map(st => `
              <tr style="${st.isAbsent ? 'background: #fffbeb;' : (st.total < 10 && !st.isAbsent ? 'background: #fff1f2;' : '')}">
                <td class="text-center font-bold">${st.rollNo}</td>
                <td class="font-bold">${st.name}</td>
                <td class="text-center">${st.house || '—'}</td>
                <td class="text-center font-bold">${st.isAbsent ? 'ABSENT' : `${st.total} / ${cls.maxMarks || st.maxMarks}`}</td>
                <td class="text-center">${st.isAbsent ? '—' : `${st.percentage}%`}</td>
                <td class="text-center font-bold">${st.isAbsent ? 'ABSENT' : st.total < 10 ? 'ATTENTION' : 'PASS'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="signatures">
          <div class="sign-box">Class Teacher Signature</div>
          <div class="sign-box">Principal Signature</div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Filter students inside modal
  const filteredModalStudents = useMemo(() => {
    if (!modalSearch.trim()) return modalStudents;
    const q = modalSearch.toLowerCase().trim();
    return modalStudents.filter(s => 
      s.name.toLowerCase().includes(q) || 
      String(s.rollNo).includes(q) ||
      (s.house && s.house.toLowerCase().includes(q))
    );
  }, [modalStudents, modalSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-300">
        <RefreshCw className="animate-spin mr-3 text-brand-500" size={20} />
        <span className="text-sm font-semibold">Loading Weekly Test Report...</span>
      </div>
    );
  }

  const summary = report?.summary_data || {};
  const honours = report?.honours_data || [];
  const subjectHonours = report?.subject_honours_data || report?.summary_data?.subject_honours_data || [];
  const requiresAttention = report?.requires_attention_data || [];
  const missing = report?.missing_submissions_data || completionData?.missingSubmissions || [];
  const classDetails = report?.class_details_data || [];
  const isFinal = report?.status === 'FINAL';

  // Filtered class details for All Student Marksheets mode
  const filteredClasses = classDetails.filter(cls => {
    if (selectedClassFilter === 'ALL') return true;
    return cls.classId === selectedClassFilter;
  });

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* 1. TOP COMMAND HEADER */}
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
                {isFinal ? '🟢 FINAL REPORT' : '🟡 LIVE REPORT (IN PROGRESS)'}
              </span>
              {report?.version > 1 && (
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold">
                  Version V{report.version} (Revised)
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              Senior School Weekly Test Report & Marksheets
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>{report?.week_identifier || 'Weekly Test'}</span>
              <span>•</span>
              <span>Test Date: <strong className="text-slate-200">{report?.test_date}</strong></span>
              <span>•</span>
              <span>Classes 5–12</span>
              {lastUpdated && (
                <>
                  <span>•</span>
                  <span className="text-slate-400">Updated: <strong className="text-slate-300">{lastUpdated}</strong></span>
                </>
              )}
            </p>
          </div>

          {/* Quick Primary Actions & Term Toggle */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Term Toggle */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => handleTermChange('Finalterm')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  selectedTerm === 'Finalterm'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Final-Term
              </button>
              <button
                type="button"
                onClick={() => handleTermChange('Midterm')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  selectedTerm === 'Midterm'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Mid-Term
              </button>
            </div>

            {/* Recompile / Refresh */}
            {isPrincipalOrAdmin && (
              <button
                type="button"
                onClick={() => handleRunReportCheck(true)}
                disabled={isRefreshing || isCompiling}
                title="Recompile live marks entered by teachers"
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={(isRefreshing || isCompiling) ? 'animate-spin' : ''} size={14} />
                <span className="hidden sm:inline">{(isRefreshing || isCompiling) ? 'Compiling...' : 'Recompile'}</span>
              </button>
            )}

            {/* Download PDF */}
            {report && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingPdf ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    <span>PDF...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Open PDF</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Report Archive & Selector Bar */}
        <div className="mt-3 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-400" />
            <span className="font-semibold">Archive:</span>
            {archive.length > 0 ? (
              <select
                value={selectedReportId || ''}
                onChange={e => handleSelectReport(e.target.value)}
                className="bg-slate-950 text-white font-medium px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 text-xs"
              >
                {archive.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.week_identifier} ({a.test_date}) — V{a.version} [{a.status}]
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-slate-500 italic">Live In-Memory Compilation (Active)</span>
            )}
          </div>

          {/* Secondary WhatsApp action */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSendWhatsAppNotification}
              className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-800/60 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
              title="Share short notification with Principal on WhatsApp"
            >
              <Send size={12} />
              <span>WhatsApp Alert</span>
            </button>
            <button
              type="button"
              onClick={handleCopyWhatsAppText}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium transition cursor-pointer"
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
                  Weekly Test Report — Live Progress ({selectedTerm === 'Finalterm' ? 'Final Term' : 'Mid Term'})
                </h4>
                {missing.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowMissingModal(!showMissingModal)}
                    className="text-xs text-amber-400 underline font-semibold cursor-pointer"
                  >
                    {showMissingModal ? 'Hide Incomplete Details' : `View ${missing.length} Incomplete Entries`}
                  </button>
                )}
              </div>
              <p className="text-xs text-amber-300/80 mt-1">
                Reflecting live teacher-entered marks for Tuesday Assembly. Official FINAL report will be locked upon full completion & coordinator verification.
              </p>

              {showMissingModal && missing.length > 0 && (
                <div className="mt-3 bg-slate-950/80 rounded-xl p-3 border border-amber-900/50 max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="text-[10px] uppercase text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="pb-1">Class</th>
                        <th className="pb-1">Subject</th>
                        <th className="pb-1">Teacher</th>
                        <th className="pb-1 text-center">Entered</th>
                        <th className="pb-1 text-center">Pending</th>
                        <th className="pb-1 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {missing.map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/50">
                          <td className="py-1.5 font-bold text-white">{m.className} {m.section}</td>
                          <td className="py-1.5">{m.subjectName}</td>
                          <td className="py-1.5 text-slate-400">{m.teacherName}</td>
                          <td className="py-1.5 text-center text-emerald-400 font-mono">{m.enteredCount}</td>
                          <td className="py-1.5 text-center text-rose-400 font-mono font-bold">{m.pendingCount}</td>
                          <td className="py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenMarksModal({
                                classId: m.classId,
                                fullClassName: `${m.className} ${m.section}`.trim(),
                                subjectId: m.subjectId,
                                subjectName: m.subjectName,
                                teacherName: m.teacherName
                              })}
                              className="px-2.5 py-0.5 rounded bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 text-[10px] font-bold transition cursor-pointer"
                            >
                              View Marks
                            </button>
                          </td>
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
            {summary.completedClasses ?? completionData?.completedClasses ?? 0} / {summary.totalClasses ?? completionData?.totalClasses ?? 8}
          </span>
          {completionData?.classesWithMarks !== undefined && (
            <span className="text-[10px] text-amber-400 block font-medium">
              {completionData.classesWithMarks} with entries
            </span>
          )}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Subjects</span>
          <span className="text-lg font-black text-white">
            {summary.completedSubjects ?? completionData?.completedAssignedSubjects ?? 0} / {summary.totalSubjects ?? completionData?.totalAssignedSubjects ?? 0}
          </span>
          {completionData?.subjectsWithMarks !== undefined && (
            <span className="text-[10px] text-amber-400 block font-medium">
              {completionData.subjectsWithMarks} with marks
            </span>
          )}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Evaluated</span>
          <span className="text-lg font-black text-emerald-400">
            {summary.studentsEvaluated ?? completionData?.totalStudentsEvaluated ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 block">Marks entered</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Absentees</span>
          <span className="text-lg font-black text-amber-400">
            {summary.studentsAbsent ?? completionData?.totalStudentsAbsent ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 block">Marked absent</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Attention</span>
          <span className="text-lg font-black text-rose-400">
            {summary.studentsRequiringAttention ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 block">Below 10</span>
        </div>
      </div>

      {/* 4. TUESDAY ASSEMBLY HONOURS & MARKSSHEETS SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 mb-4 gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="text-amber-400 shrink-0" size={20} />
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                Senior School Weekly Test Results
              </h3>
              <p className="text-[11px] text-slate-400">
                Senior School (Classes 5–8 Max 25 • Classes 9–12 Max 20)
              </p>
            </div>
          </div>

          {/* View Mode Switcher: Class Consolidated vs By Subject vs All Student Marksheets */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setHonoursViewMode('class')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                honoursViewMode === 'class'
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🏅 Class Honours</span>
            </button>
            <button
              type="button"
              onClick={() => setHonoursViewMode('subject')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                honoursViewMode === 'subject'
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen size={13} />
              <span>By Subject (Assembly Slips)</span>
              {subjectHonours.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  honoursViewMode === 'subject' ? 'bg-slate-950 text-amber-400 font-black' : 'bg-slate-800 text-slate-300'
                }`}>
                  {subjectHonours.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setHonoursViewMode('all_marksheets')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                honoursViewMode === 'all_marksheets'
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText size={13} />
              <span>All Student Marksheets</span>
              {classDetails.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  honoursViewMode === 'all_marksheets' ? 'bg-slate-950 text-amber-400 font-black' : 'bg-slate-800 text-slate-300'
                }`}>
                  {classDetails.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* View 1: Class Consolidated Honours */}
        {honoursViewMode === 'class' && (
          honours.length === 0 ? (
            <div className="text-slate-400 text-center py-6 text-xs space-y-2">
              <p className="italic">No honours evaluated yet for {selectedTerm === 'Finalterm' ? 'Final Term' : 'Mid Term'}.</p>
              <button
                type="button"
                onClick={() => handleRunReportCheck(true)}
                disabled={isRefreshing || isCompiling}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <RefreshCw className={(isRefreshing || isCompiling) ? 'animate-spin' : ''} size={13} />
                <span>Compile Live Marks Now</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {honours.map(clsH => (
                <div 
                  key={clsH.classId}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 hover:border-slate-700 transition"
                >
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
                    <div>
                      <h4 className="font-black text-sm text-white">{clsH.fullClassName}</h4>
                      <span className="text-[10px] text-amber-400/90 font-semibold block">
                        Scale: Max {clsH.maxMarks || 25} Marks
                      </span>
                    </div>
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
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="font-bold text-slate-100">{s.total} / {clsH.maxMarks || s.maxMarks}</span>
                                <span className="text-amber-400 text-[10px] font-semibold">({s.percentage}%)</span>
                              </div>
                              {s.rawTotal !== undefined && s.rawTotal !== s.total && (
                                <div className="text-[9px] text-slate-500 font-normal">
                                  Raw: {s.rawTotal} / {s.rawMaxMarks}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* View 2: By Subject (Assembly Slips) */}
        {honoursViewMode === 'subject' && (
          subjectHonours.length === 0 ? (
            <div className="text-slate-400 text-center py-6 text-xs space-y-2">
              <p className="italic">No subject test slips entered yet for {selectedTerm === 'Finalterm' ? 'Final Term' : 'Mid Term'}.</p>
              <button
                type="button"
                onClick={() => handleRunReportCheck(true)}
                disabled={isRefreshing || isCompiling}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <RefreshCw className={(isRefreshing || isCompiling) ? 'animate-spin' : ''} size={13} />
                <span>Compile Live Marks Now</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {subjectHonours.map(subH => (
                <div 
                  key={`${subH.classId}_${subH.subjectId}`}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 hover:border-slate-700 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold text-[10px]">
                            {subH.fullClassName}
                          </span>
                          <h4 className="font-black text-sm text-white">{subH.subjectName}</h4>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Teacher: <span className="text-slate-200 font-medium">{subH.teacherName}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-amber-400 uppercase bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                          Max: {subH.maxMarks} • Pass: {subH.passingMarks || 10}
                        </span>
                        <div className="text-[9px] text-slate-500 mt-0.5">
                          {subH.evaluatedCount} evaluated {subH.absentCount > 0 ? `(${subH.absentCount} absent)` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Top 3 Rankers */}
                    {subH.topScorers.length === 0 ? (
                      <span className="text-slate-500 italic text-xs block py-1">No marks entered</span>
                    ) : (
                      <ul className="space-y-1.5">
                        {subH.topScorers.map(s => {
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
                                <span className="font-bold text-slate-200">{s.total} / {subH.maxMarks}</span>
                                <span className="text-slate-400 text-[10px] ml-1">({s.percentage}%)</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* Requires Attention (< 10) in this subject */}
                    {subH.requiresAttention && subH.requiresAttention.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block mb-1">
                          Requires Attention (&lt; {subH.passingMarks || 10}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {subH.requiresAttention.map(att => (
                            <span 
                              key={att.studentId}
                              className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-900/50 text-[10px] font-medium"
                            >
                              {att.name}: <strong className="font-mono text-rose-200">{att.total}/{subH.maxMarks}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action button to view all student marks */}
                  <button
                    type="button"
                    onClick={() => handleOpenMarksModal({
                      classId: subH.classId,
                      fullClassName: subH.fullClassName,
                      subjectId: subH.subjectId,
                      subjectName: subH.subjectName,
                      teacherName: subH.teacherName,
                      maxMarks: subH.maxMarks,
                      passingMarks: subH.passingMarks,
                      students: subH.allStudents
                    })}
                    className="mt-3 w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <FileText size={12} className="text-brand-400" />
                    <span>View All Student Marks</span>
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* View 3: All Student Marksheets (Comprehensive Class-by-Class View) */}
        {honoursViewMode === 'all_marksheets' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="font-bold text-slate-400 uppercase text-[10px]">Filter Class:</span>
                <select
                  value={selectedClassFilter}
                  onChange={e => setSelectedClassFilter(e.target.value)}
                  className="bg-slate-900 text-white font-medium px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs w-full sm:w-52"
                >
                  <option value="ALL">All Senior Classes ({classDetails.length})</option>
                  {classDetails.map(c => (
                    <option key={c.classId} value={c.classId}>{c.fullClassName}</option>
                  ))}
                </select>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  value={marksheetSearch}
                  onChange={e => setMarksheetSearch(e.target.value)}
                  placeholder="Search student or roll..."
                  className="bg-slate-900 text-white placeholder-slate-500 pl-8 pr-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs w-full"
                />
              </div>
            </div>

            {/* Display each class roster */}
            {filteredClasses.length === 0 ? (
              <div className="text-slate-400 text-center py-8 text-xs italic bg-slate-950/40 rounded-xl border border-slate-800">
                No class marksheets found matching your criteria. Try compiling live marks.
              </div>
            ) : (
              filteredClasses.map(cls => {
                const studentsToRender = marksheetSearch.trim()
                  ? (cls.roster || []).filter(st => 
                      st.name.toLowerCase().includes(marksheetSearch.toLowerCase().trim()) ||
                      String(st.rollNo).includes(marksheetSearch.toLowerCase().trim()) ||
                      (st.house && st.house.toLowerCase().includes(marksheetSearch.toLowerCase().trim()))
                    )
                  : (cls.roster || []);

                return (
                  <div key={cls.classId} className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-800 gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm text-white">{cls.fullClassName}</h4>
                          <span className="text-[10px] font-bold text-amber-400 uppercase bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                            Scale: Max {cls.maxMarks || 25}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          {cls.roster?.length || 0} Students Evaluated
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePrintIndividualClass(cls)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                      >
                        <Printer size={13} />
                        <span>Print Class Marksheet</span>
                      </button>
                    </div>

                    {studentsToRender.length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-500 italic">No matching students found in this class.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                            <tr>
                              <th className="p-2 w-14 text-center">Roll</th>
                              <th className="p-2">Student Name</th>
                              <th className="p-2 w-24 text-center">House</th>
                              <th className="p-2 w-28 text-center">Marks ({cls.maxMarks || 25})</th>
                              <th className="p-2 w-20 text-center">Percentage</th>
                              <th className="p-2 w-24 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900">
                            {studentsToRender.map(st => {
                              const isBelowThreshold = !st.isAbsent && st.total < (report.config_snapshot?.requires_attention_threshold || 10);
                              return (
                                <tr key={st.studentId} className={`hover:bg-slate-900/60 ${st.isAbsent ? 'bg-amber-950/20' : isBelowThreshold ? 'bg-rose-950/20' : ''}`}>
                                  <td className="p-2 text-center font-bold text-white">{st.rollNo}</td>
                                  <td className="p-2 font-semibold text-white">{st.name}</td>
                                  <td className="p-2 text-center text-slate-400">{st.house || '—'}</td>
                                  <td className="p-2 text-center font-mono font-bold text-slate-200">
                                    {st.isAbsent ? (
                                      <span className="text-amber-400">ABSENT</span>
                                    ) : (
                                      <span>{st.total} / {cls.maxMarks || st.maxMarks}</span>
                                    )}
                                  </td>
                                  <td className="p-2 text-center font-mono">
                                    {st.isAbsent ? '—' : `${st.percentage}%`}
                                  </td>
                                  <td className="p-2 text-center">
                                    {st.isAbsent ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">ABSENT</span>
                                    ) : isBelowThreshold ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">ATTENTION</span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">PASS</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
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
                <div className="font-mono text-right">
                  <span className="font-bold text-rose-400">
                    {st.total} / {st.maxMarks || c.maxMarks || 25} ({st.percentage}%)
                  </span>
                  {st.rawTotal !== undefined && st.rawTotal !== st.total && (
                    <span className="text-[9px] text-slate-500 font-normal ml-1">
                      (Raw: {st.rawTotal}/{st.rawMaxMarks})
                    </span>
                  )}
                </div>
              </div>
            )))}
          </div>
        </div>
      )}

      {/* 6. INTERACTIVE STUDENT MARKS MODAL (View Marks on Subject Slip or Missing Row) */}
      {activeMarksModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-start bg-slate-950">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
                    Weekly Test Marksheet
                  </span>
                  <span className="text-xs text-slate-400">Class: <strong className="text-white">{activeMarksModal.fullClassName}</strong></span>
                </div>
                <h3 className="text-lg font-black text-white mt-1">
                  {activeMarksModal.subjectName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Teacher: <span className="text-slate-200 font-semibold">{activeMarksModal.teacherName}</span> • Max Marks: <span className="text-amber-400 font-mono font-bold">{activeMarksModal.maxMarks || 25}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handlePrintIndividualClass({
                      fullClassName: `${activeMarksModal.fullClassName} — ${activeMarksModal.subjectName}`,
                      maxMarks: activeMarksModal.maxMarks,
                      roster: modalStudents
                    });
                  }}
                  className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
                  title="Print this marksheet"
                >
                  <Printer size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMarksModal(null)}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Search & Count */}
            <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  placeholder="Search student or roll..."
                  className="bg-slate-950 text-white placeholder-slate-500 pl-8 pr-3 py-1.5 rounded-lg border border-slate-700 text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="text-xs text-slate-400">
                Total: <strong className="text-white">{modalStudents.length}</strong> students
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {modalLoading ? (
                <div className="text-center py-12">
                  <RefreshCw className="animate-spin mx-auto text-brand-500 mb-2" size={24} />
                  <p className="text-xs text-slate-400">Loading student marks...</p>
                </div>
              ) : filteredModalStudents.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400 italic">
                  No marks or students found for this entry.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 uppercase text-[10px] text-slate-400 border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="p-2 text-center w-12">Roll</th>
                      <th className="p-2">Student Name</th>
                      <th className="p-2 text-center w-20">House</th>
                      <th className="p-2 text-center w-24">Marks ({activeMarksModal.maxMarks || 25})</th>
                      <th className="p-2 text-center w-16">%</th>
                      <th className="p-2 text-center w-20">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredModalStudents.map(st => (
                      <tr key={st.studentId} className={`hover:bg-slate-800/40 ${st.isAbsent ? 'bg-amber-950/20' : st.total < 10 && !st.isAbsent ? 'bg-rose-950/20' : ''}`}>
                        <td className="p-2 text-center font-bold text-slate-200">{st.rollNo}</td>
                        <td className="p-2 font-semibold text-white">{st.name}</td>
                        <td className="p-2 text-center text-slate-400">{st.house || '—'}</td>
                        <td className="p-2 text-center font-mono font-bold">
                          {st.isAbsent ? (
                            <span className="text-amber-400">ABSENT</span>
                          ) : st.total !== null && st.total !== undefined ? (
                            <span className="text-white">{st.total} / {activeMarksModal.maxMarks || st.maxMarks || 25}</span>
                          ) : (
                            <span className="text-slate-500">Pending</span>
                          )}
                        </td>
                        <td className="p-2 text-center font-mono text-slate-300">
                          {st.percentage ? `${st.percentage}%` : '—'}
                        </td>
                        <td className="p-2 text-center">
                          {st.isAbsent ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">ABSENT</span>
                          ) : st.total !== null && st.total < 10 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">ATTENTION</span>
                          ) : st.total !== null ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">PASS</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">PENDING</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveMarksModal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. HIDDEN PRINTABLE / PDF TEMPLATE (Rendered strictly from immutable server snapshot) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <WeeklyTestConsolidatedPDF 
          report={report} 
          innerRef={pdfContainerRef}
        />
      </div>
    </div>
  );
}
