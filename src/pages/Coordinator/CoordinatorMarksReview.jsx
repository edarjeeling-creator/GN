import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { MarksWorkflowService } from '../../services/MarksWorkflowService';
import { MarksCalculationEngine } from '../../services/MarksCalculationEngine';
import { 
  ArrowLeft, CheckCircle2, Lock, RotateCcw, AlertTriangle, 
  HelpCircle, ShieldAlert, FileText, User, X, Info
} from 'lucide-react';

export default function CoordinatorMarksReview() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { classes, subjects, students } = useData();

  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState(null);
  const [pattern, setPattern] = useState(null);
  const [detailedMarks, setDetailedMarks] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal States
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [calculationModalStudent, setCalculationModalStudent] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);

  // Load submission and related data
  const loadSubmissionData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Fetch submission record
      const { data: sub, error: sErr } = await supabase
        .from('class_subject_mark_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

      if (sErr || !sub) {
        throw new Error('Could not find the requested mark submission.');
      }
      setSubmission(sub);

      // 2. Fetch pattern with components and boundaries
      const patterns = await MarksWorkflowService.getAssessmentPatterns(sub.academic_year);
      const cls = classes.find(c => c.id === sub.class_id);
      const activePattern = (sub.pattern_id ? patterns.find(p => p.id === sub.pattern_id) : null) || 
                            MarksCalculationEngine.resolvePattern(cls?.name, sub.academic_year, patterns);
      setPattern(activePattern);

      // 3. Fetch detailed marks
      const marks = await MarksWorkflowService.getSubmissionDetailedMarks(submissionId);
      setDetailedMarks(marks);

      // 4. Fetch audit logs if available
      const { data: logs } = await supabase
        .from('marks_workflow_audit_logs')
        .select('*')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false });
      setAuditLogs(logs || []);

    } catch (err) {
      console.error('Error loading submission:', err);
      setErrorMsg(err.message || 'Failed to load submission data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (submissionId) {
      loadSubmissionData();
    }
  }, [submissionId, classes]);

  // Derived metadata
  const cls = classes.find(c => c.id === submission?.class_id);
  const sub = subjects.find(s => s.id === submission?.subject_id);

  // Roster of students for this class
  const classStudents = useMemo(() => {
    if (!submission?.class_id) return [];
    return (students || [])
      .filter(s => (s.class_id === submission.class_id || s.classId === submission.class_id) && s.status !== 'inactive')
      .sort((a, b) => (Number(a.roll_no) || 0) - (Number(b.roll_no) || 0));
  }, [students, submission]);

  // Map student calculations
  const studentRows = useMemo(() => {
    if (!pattern || !classStudents.length) return [];
    const components = pattern.components || [];

    return classStudents.map(student => {
      const studentMarksForStudent = detailedMarks.filter(m => m.student_id === student.id);
      
      const componentScores = {};
      components.forEach(comp => {
        const found = studentMarksForStudent.find(m => m.component_id === comp.id);
        componentScores[comp.id] = {
          rawScore: found ? found.raw_score : null,
          convertedScore: found ? found.converted_score : null,
          status: found ? found.status : 'MARKED'
        };
      });

      const calc = MarksCalculationEngine.calculateStudentScores(components, componentScores, pattern) || {
        totalMarks: null,
        maxTotal: 0,
        percentage: null,
        grade: null
      };

      return {
        student,
        componentScores,
        calc
      };
    });
  }, [pattern, classStudents, detailedMarks]);

  // Action Handlers
  const handleApprove = async () => {
    if (!window.confirm('Are you sure you want to APPROVE this subject marksheet?')) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      await MarksWorkflowService.reviewSubmission({
        submissionId,
        action: 'APPROVE'
      });
      setSuccessMsg('Marksheet successfully approved! You may now lock it for official report card generation.');
      await loadSubmissionData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLock = async () => {
    if (!window.confirm('LOCK MARKS: Once locked, marks cannot be modified by teachers or ordinary users. Are you sure?')) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      await MarksWorkflowService.reviewSubmission({
        submissionId,
        action: 'LOCK'
      });
      setSuccessMsg('Marksheet has been officially LOCKED. It is now secured for report card generation.');
      await loadSubmissionData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    if (!returnReason.trim()) {
      alert('A specific reason is mandatory when returning marks for correction.');
      return;
    }
    setActionLoading(true);
    setErrorMsg('');
    try {
      await MarksWorkflowService.reviewSubmission({
        submissionId,
        action: 'RETURN',
        reason: returnReason
      });
      setShowReturnModal(false);
      setReturnReason('');
      setSuccessMsg('Marksheet returned to the teacher for correction.');
      await loadSubmissionData();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-medium text-sm">Loading submission for coordinator review...</p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertTriangle className="mx-auto text-rose-500" size={48} />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Submission Not Found</h2>
        <p className="text-sm text-slate-500">The requested marks submission could not be located.</p>
        <button onClick={() => navigate('/coordinator/marks')} className="btn btn-outline">
          Back to Control Room
        </button>
      </div>
    );
  }

  const isLocked = submission.status === 'LOCKED';
  const isApproved = submission.status === 'APPROVED';
  const isReturned = submission.status === 'RETURNED_FOR_CORRECTION';
  const isAwaitingReview = submission.status === 'SUBMITTED' || submission.status === 'RESUBMITTED';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/coordinator/marks')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition"
        >
          <ArrowLeft size={16} />
          <span>Back to Control Room</span>
        </button>

        <div className="flex items-center gap-2">
          {auditLogs.length > 0 && (
            <button
              onClick={() => setShowAuditModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            >
              <FileText size={14} />
              <span>Audit Trail ({auditLogs.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Header Info Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">
              {cls?.name} {cls?.section} — {sub?.name}
            </h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isLocked ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/50' :
              isApproved ? 'bg-blue-950/60 text-blue-300 border border-blue-500/50' :
              isReturned ? 'bg-rose-950/60 text-rose-300 border border-rose-500/50' :
              'bg-amber-950/60 text-amber-300 border border-amber-500/50'
            }`}>
              {submission.status}
            </span>
          </div>

          <p className="text-sm text-slate-300">
            Term: <strong className="text-white">{submission.term}</strong> • 
            Academic Year: <strong className="text-white">{submission.academic_year}</strong> • 
            Scheme: <strong className="text-white">{pattern?.pattern_name || 'Standard'}</strong> (v{pattern?.version || 1})
          </p>

          {submission.submission_notes && (
            <div className="mt-2 text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-700 text-slate-300">
              <strong className="text-white">Teacher Notes:</strong> {submission.submission_notes}
            </div>
          )}

          {isReturned && submission.return_reason && (
            <div className="mt-2 text-xs bg-rose-950/60 p-2.5 rounded-lg border border-rose-500 text-rose-200 flex items-start gap-2">
              <RotateCcw size={14} className="mt-0.5 shrink-0 text-rose-400" />
              <div>
                <strong className="text-white">Active Return Reason:</strong> {submission.return_reason}
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {!isLocked && (
            <>
              <button
                onClick={() => setShowReturnModal(true)}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-sm border border-rose-500 text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 transition cursor-pointer"
              >
                <RotateCcw size={16} />
                <span>Return for Correction</span>
              </button>

              {!isApproved ? (
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  <span>Approve Marks</span>
                </button>
              ) : (
                <button
                  onClick={handleLock}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer"
                >
                  <Lock size={16} />
                  <span>Lock Marks for Official Report</span>
                </button>
              )}
            </>
          )}

          {isLocked && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-950/60 text-emerald-300 border border-emerald-500/50 text-sm font-semibold">
              <Lock size={16} />
              <span>Marks Locked & Verified</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500 text-rose-200 text-sm font-medium flex items-center gap-2">
          <AlertTriangle size={18} className="text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500 text-emerald-200 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Student Roster Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="text-sm font-bold text-white">
            Student Marks Matrix ({studentRows.length} Enrolled Students)
          </div>
          <div className="text-xs text-slate-400">
            Calculated automatically by Gyanoday ERP based on configured assessment rules
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-800 text-slate-200 border-b border-slate-700 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-4 w-16 text-center text-slate-300">Roll</th>
                <th className="py-3 px-4 text-slate-200 font-bold">Student Name</th>
                {pattern?.components?.map(comp => (
                  <th key={comp.id} className="py-3 px-4 text-center text-slate-200">
                    <div className="font-bold">{comp.component_name}</div>
                    <div className="text-[10px] text-slate-400 lowercase font-normal mt-0.5">
                      raw /{comp.raw_max_marks} {comp.converted_max_marks !== comp.raw_max_marks ? `→ conv /${comp.converted_max_marks}` : ''}
                    </div>
                  </th>
                ))}
                <th className="py-3 px-4 text-center text-slate-200 font-bold">Final Total</th>
                <th className="py-3 px-4 text-center text-slate-200 font-bold">Percentage</th>
                <th className="py-3 px-4 text-center text-slate-200 font-bold">Grade</th>
                <th className="py-3 px-4 text-center text-slate-200 font-bold">Trace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {studentRows.map(({ student, componentScores, calc }) => (
                <tr key={student.id} className="hover:bg-slate-800/60 transition-colors">
                  <td className="py-3 px-4 text-center font-semibold text-slate-400">
                    {student.roll_no || '—'}
                  </td>
                  <td className="py-3 px-4 font-semibold text-white">
                    {student.name}
                  </td>

                  {/* Component Columns */}
                  {pattern?.components?.map(comp => {
                    const score = componentScores[comp.id];
                    const isAbsent = score?.status === 'ABSENT';
                    const isNA = score?.status === 'NOT_APPLICABLE';

                    return (
                      <td key={comp.id} className="py-3 px-4 text-center">
                        {isAbsent ? (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-950/60 text-rose-300 border border-rose-500/50">
                            ABS
                          </span>
                        ) : isNA ? (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            N/A
                          </span>
                        ) : score?.rawScore !== null && score?.rawScore !== undefined ? (
                          <div>
                            <span className="font-semibold text-white">
                              {score.rawScore}
                            </span>
                            {comp.converted_max_marks !== comp.raw_max_marks && (
                              <span className="text-xs text-indigo-400 font-semibold ml-1.5">
                                ({score.convertedScore})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Final Total */}
                  <td className="py-3 px-4 text-center font-bold text-white">
                    {calc.totalMarks !== null ? `${calc.totalMarks} / ${calc.maxTotal}` : '—'}
                  </td>

                  {/* Percentage */}
                  <td className="py-3 px-4 text-center font-semibold text-indigo-400">
                    {calc.percentage !== null ? `${calc.percentage}%` : '—'}
                  </td>

                  {/* Grade */}
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {calc.grade || '—'}
                    </span>
                  </td>

                  {/* Trace button */}
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setCalculationModalStudent({ student, componentScores, calc })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition cursor-pointer"
                      title="Inspect Calculation Trace"
                    >
                      <Info size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return for Correction Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
                <RotateCcw size={20} />
                <span>Return Marksheet for Correction</span>
              </div>
              <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400">
              Please enter the exact reason and required corrections for the teacher. 
              This explanation is mandatory and will be displayed prominently on the teacher's screen.
            </p>

            <form onSubmit={handleReturn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Correction Reason / Instructions *
                </label>
                <textarea
                  required
                  rows={4}
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  placeholder="e.g. Please verify Roll No 14 exam marks against the physical answer script, and confirm absent status for Roll No 21..."
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !returnReason.trim()}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Returning...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Calculation Breakdown Modal */}
      {calculationModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                <Info size={20} />
                <span>Calculation Breakdown</span>
              </div>
              <button onClick={() => setCalculationModalStudent(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white">
                {calculationModalStudent.student.name} (Roll: {calculationModalStudent.student.roll_no || 'N/A'})
              </div>
              <div className="text-xs text-slate-500">
                Pattern: {pattern?.pattern_name} (Version {pattern?.version || 1})
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Step-by-Step Conversion:
              </div>

              {pattern?.components?.map(comp => {
                const score = calculationModalStudent.componentScores[comp.id];
                const raw = score?.rawScore;
                const conv = score?.convertedScore;
                const isConv = comp.converted_max_marks !== comp.raw_max_marks;

                return (
                  <div key={comp.id} className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                      <span>{comp.component_name}</span>
                      <span>Raw: {raw !== null ? `${raw} / ${comp.raw_max_marks}` : 'Not entered'}</span>
                    </div>
                    {isConv && raw !== null && (
                      <div className="text-slate-500 font-mono text-[11px]">
                        Conversion: ({raw} ÷ {comp.raw_max_marks}) × {comp.converted_max_marks} = <strong>{conv}</strong> / {comp.converted_max_marks}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 text-xs space-y-1 text-indigo-900 dark:text-indigo-200">
                <div className="flex justify-between font-bold text-sm">
                  <span>Final Aggregated Total:</span>
                  <span>{calculationModalStudent.calc.totalMarks} / {calculationModalStudent.calc.maxTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Calculated Percentage:</span>
                  <span className="font-bold">{calculationModalStudent.calc.percentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Awarded Grade:</span>
                  <span className="font-bold">{calculationModalStudent.calc.grade || '—'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCalculationModalStudent(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit History Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                <FileText size={20} />
                <span>Audit & Revision History</span>
              </div>
              <button onClick={() => setShowAuditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 divide-y divide-slate-100 dark:divide-slate-700">
              {auditLogs.map(log => (
                <div key={log.id} className="pt-2 text-xs space-y-1">
                  <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-200">
                    <span className="uppercase">{log.action}</span>
                    <span className="text-slate-400 font-normal">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  {log.previous_status && log.new_status && (
                    <div className="text-slate-500">
                      Transition: {log.previous_status} → <strong>{log.new_status}</strong>
                    </div>
                  )}
                  {log.reason && (
                    <div className="text-slate-600 dark:text-slate-300 italic">
                      "{log.reason}"
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
