import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { MarksWorkflowService } from '../../services/MarksWorkflowService';
import { 
  Printer, Lock, AlertTriangle, CheckCircle2, ShieldCheck, 
  Clock, ArrowLeft, RefreshCw, FileText, Download, Layers,
  ChevronRight, Calendar
} from 'lucide-react';

export default function ReportPrintingControl() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { classes, academicYear } = useData();

  const [selectedYear, setSelectedYear] = useState(academicYear || '2026');
  const [selectedTerm, setSelectedTerm] = useState('Midterm');
  const [loading, setLoading] = useState(true);
  const [classReadiness, setClassReadiness] = useState([]);
  const [printLogs, setPrintLogs] = useState([]);
  const [selectedClassForLog, setSelectedClassForLog] = useState(null);

  // Load readiness status for all classes
  const loadClassReadiness = async () => {
    setLoading(true);
    try {
      const results = [];
      for (const cls of classes || []) {
        const check = await MarksWorkflowService.verifyReportReadiness({
          classId: cls.id,
          academicYear: selectedYear,
          term: selectedTerm
        });

        results.push({
          classId: cls.id,
          className: cls.name,
          section: cls.section || 'A',
          isReady: check.isReady,
          totalSubjects: check.totalSubjects,
          lockedSubjects: check.lockedSubjects,
          pendingCount: check.pendingSubjectsCount,
          unlockedSubjects: check.unlockedSubjects || []
        });
      }

      setClassReadiness(results);

      // Also fetch recent report print logs
      const { data: logs } = await supabase
        .from('report_print_logs')
        .select(`
          *,
          classes(name, section),
          profiles:printed_by(name, role)
        `)
        .eq('academic_year', selectedYear)
        .eq('term', selectedTerm)
        .order('printed_at', { ascending: false });

      setPrintLogs(logs || []);
    } catch (err) {
      console.error('Error verifying class readiness:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (classes && classes.length > 0) {
      loadClassReadiness();
    }
  }, [classes, selectedYear, selectedTerm]);

  // Handle official printing trigger
  const handlePrintOfficial = async (item) => {
    if (!item.isReady) {
      alert(`Cannot print official report cards: ${item.pendingCount} subject(s) are not yet approved and locked by Coordinator.`);
      return;
    }

    try {
      // Determine version number from existing logs for this class & term
      const existingForClass = printLogs.filter(l => l.class_id === item.classId);
      const versionNumber = existingForClass.length + 1;
      const reportVersion = `${selectedTerm.toUpperCase()}-${selectedYear}-V${versionNumber}`;

      // Log the event securely
      await MarksWorkflowService.logPrintEvent({
        classId: item.classId,
        academicYear: selectedYear,
        term: selectedTerm,
        reportVersion,
        studentCount: item.totalStudents || 0,
        notes: `Official batch report cards printed by ${profile?.name || 'Coordinator'}`
      });

      // Navigate to the printable report cards page
      navigate(`/classes/${item.classId}/reports?official=true&version=${reportVersion}`);
    } catch (err) {
      alert('Printing blocked: ' + err.message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800">
        <div>
          <button
            onClick={() => navigate('/coordinator/marks')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white mb-2 transition cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Coordinator Control Room
          </button>
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
            <ShieldCheck size={18} />
            <span>Official Report Printing Gatekeeper</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Report Card Generation & Print Controls
          </h1>
          <p className="text-sm text-slate-300 mt-0.5">
            Strict server gatekeeping: Report printing is blocked until 100% of subject marks are verified, approved, and locked.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-white text-sm font-medium focus:outline-none focus:border-indigo-500"
          >
            <option value="2026">Academic Year 2026-27</option>
            <option value="2025">Academic Year 2025-26</option>
          </select>

          <select
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-white text-sm font-medium focus:outline-none focus:border-indigo-500"
          >
            <option value="Midterm">Mid-Term Examination</option>
            <option value="Finalterm">Final-Term Examination</option>
          </select>

          <button
            onClick={loadClassReadiness}
            className="p-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition cursor-pointer"
            title="Refresh Status"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Class Gatekeeper Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {classReadiness.map(item => (
          <div
            key={item.classId}
            className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
              item.isReady
                ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md'
                : 'bg-slate-900 border-slate-800 shadow-sm'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {item.className}
                  </h2>
                  <span className="text-xs text-slate-400 font-medium">Section {item.section}</span>
                </div>

                {item.isReady ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <CheckCircle2 size={13} /> READY TO PRINT
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <Lock size={13} /> LOCKED GATE
                  </span>
                )}
              </div>

              {/* Progress Indicator */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-300">
                  <span>Subject Lock Completion:</span>
                  <span className="font-bold text-white">
                    {item.lockedSubjects} / {item.totalSubjects} Subjects
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                  <div
                    className={`h-full transition-all duration-500 ${
                      item.isReady ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    style={{
                      width: `${item.totalSubjects > 0 ? (item.lockedSubjects / item.totalSubjects) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Status Message / Pending Subjects List */}
              {item.isReady ? (
                <div className="text-xs bg-emerald-900/30 text-emerald-200 p-3 rounded-xl border border-emerald-500/30 flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                  <span>All required subjects approved and locked by Coordinator.</span>
                </div>
              ) : (
                <div className="space-y-2 text-xs bg-amber-950/40 p-3 rounded-xl border border-amber-500/30 text-amber-200">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                    <span>Awaiting Coordinator Approval — {item.pendingCount} subject(s) pending</span>
                  </div>
                  {item.unlockedSubjects.length > 0 && (
                    <ul className="pl-4 list-disc text-slate-300 space-y-0.5">
                      {item.unlockedSubjects.slice(0, 4).map((sub, i) => (
                        <li key={i}>
                          <span className="font-medium text-white">{sub.subjectName}</span> ({sub.status})
                        </li>
                      ))}
                      {item.unlockedSubjects.length > 4 && (
                        <li className="text-slate-400 italic">
                          +{item.unlockedSubjects.length - 4} more pending subjects...
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-4 mt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => navigate(`/classes/${item.classId}/flowsheet`)}
                className="text-xs font-semibold text-slate-400 hover:text-indigo-400 transition cursor-pointer"
              >
                View Flowsheet
              </button>

              {item.isReady ? (
                <button
                  onClick={() => handlePrintOfficial(item)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Print Official Reports</span>
                </button>
              ) : (
                <button
                  disabled
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed"
                  title="Printing blocked until all subjects are locked"
                >
                  <Lock size={14} />
                  <span>Printing Locked</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Official Print History Audit Trail */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <FileText size={18} className="text-indigo-400" />
            <span>Permanent Report Card Print History & Versioning</span>
          </div>
          <div className="text-xs text-slate-400">
            Audit-logged record of all generated batch report cards
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800 text-slate-200 border-b border-slate-700 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4 text-slate-200 font-bold">Class</th>
                <th className="py-3 px-4 text-slate-200 font-bold">Term & Year</th>
                <th className="py-3 px-4 text-slate-200 font-bold">Report Version</th>
                <th className="py-3 px-4 text-slate-200 font-bold">Printed By</th>
                <th className="py-3 px-4 text-slate-200 font-bold">Timestamp</th>
                <th className="py-3 px-4 text-slate-200 font-bold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {printLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400 font-medium">
                    No official report card print events recorded for this term.
                  </td>
                </tr>
              ) : (
                printLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-white">
                      {log.classes?.name} {log.classes?.section}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {log.term} ({log.academic_year})
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                      {log.report_version}
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      {log.profiles?.name || 'Administrator'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(log.printed_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-400 italic">
                      {log.notes || 'Official Batch Print'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
