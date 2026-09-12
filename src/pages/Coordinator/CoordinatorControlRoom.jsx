import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { MarksWorkflowService } from '../../services/MarksWorkflowService';
import { 
  CheckCircle2, Lock, Clock, RotateCcw, 
  FileText, Search, Eye, Printer, ShieldCheck, 
  RefreshCw
} from 'lucide-react';

export default function CoordinatorControlRoom() {
  const navigate = useNavigate();
  const { classes, subjects, teacherSubjects, students, academicYear } = useData();

  const [selectedTerm, setSelectedTerm] = useState('Midterm');
  const [selectedYear, setSelectedYear] = useState(academicYear || '2026');
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [allYearSubmissions, setAllYearSubmissions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [overviewStats, setOverviewStats] = useState({
    total: 0,
    draft: 0,
    submitted: 0,
    underReview: 0,
    returned: 0,
    approved: 0,
    locked: 0
  });

  // Fetch overview data
  const loadSubmissions = async () => {
    setLoading(true);
    try {
      // Fetch all submissions for the academic year to support cross-term detection & filtering
      const allData = await MarksWorkflowService.getCoordinatorOverview(selectedYear, 'ALL');
      setAllYearSubmissions(allData || []);

      const relevantData = selectedTerm === 'ALL'
        ? (allData || [])
        : (allData || []).filter(s => s.term === selectedTerm);
      setSubmissions(relevantData);

      const stats = {
        total: relevantData.length,
        draft: relevantData.filter(s => s.status === 'DRAFT').length,
        submitted: relevantData.filter(s => s.status === 'SUBMITTED' || s.status === 'RESUBMITTED').length,
        underReview: relevantData.filter(s => s.status === 'UNDER_REVIEW').length,
        returned: relevantData.filter(s => s.status === 'RETURNED_FOR_CORRECTION').length,
        approved: relevantData.filter(s => s.status === 'APPROVED').length,
        locked: relevantData.filter(s => s.status === 'LOCKED').length,
      };
      setOverviewStats(stats);
    } catch (err) {
      console.error('Error fetching coordinator overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [selectedYear, selectedTerm]);

  // Alert if pending submissions exist in another term
  const otherTermAlert = useMemo(() => {
    if (selectedTerm === 'ALL') return null;
    const otherTerm = selectedTerm === 'Midterm' ? 'Finalterm' : 'Midterm';
    const otherTermLabel = otherTerm === 'Midterm' ? 'Mid-Term Examination' : 'Final-Term Examination';
    const pendingCount = (allYearSubmissions || []).filter(s => 
      s.term === otherTerm && (s.status === 'SUBMITTED' || s.status === 'RESUBMITTED')
    ).length;
    
    if (pendingCount > 0) {
      return {
        term: otherTerm,
        label: otherTermLabel,
        count: pendingCount
      };
    }
    return null;
  }, [allYearSubmissions, selectedTerm]);

  // Combine loaded submissions with all registered class subjects so empty/not-yet-entered subjects show up
  const fullRosterMatrix = useMemo(() => {
    const list = [];
    if (!classes || !subjects) return list;

    const matchedSubmissionIds = new Set();

    classes.forEach(cls => {
      const assignedSubjectIds = teacherSubjects?.[cls.id] || [];
      const classStudents = (students || []).filter(s => (s.class_id === cls.id || s.classId === cls.id) && s.status !== 'inactive');
      const totalStudentsCount = classStudents.length;

      subjects.forEach(sub => {
        const isAssigned = assignedSubjectIds.includes(sub.id);
        const existing = (submissions || []).find(s => 
          s.class_id === cls.id && 
          s.subject_id === sub.id && 
          (selectedTerm === 'ALL' || s.term === selectedTerm)
        );

        // If not assigned and no submission exists, skip if specific subjects are mapped
        if (!isAssigned && assignedSubjectIds.length > 0 && !existing) return;

        if (existing) {
          matchedSubmissionIds.add(existing.id);
        }

        list.push({
          key: `${cls.id}_${sub.id}_${existing?.term || selectedTerm}`,
          class_id: cls.id,
          className: cls.name,
          section: cls.section || 'A',
          subject_id: sub.id,
          subjectName: sub.name,
          term: existing?.term || selectedTerm,
          teacherName: existing?.teacher_name || 'Assigned Subject Teacher',
          submissionId: existing?.id,
          status: existing?.status || 'NOT_STARTED',
          submittedAt: existing?.submitted_at,
          returnedReason: existing?.return_reason,
          lockedAt: existing?.locked_at,
          totalStudents: totalStudentsCount || existing?.total_students || 0,
          markedStudents: existing?.marked_students || 0
        });
      });
    });

    // Also include any submissions returned by the database that weren't matched in classes/subjects loops
    (submissions || []).forEach(subm => {
      if (!matchedSubmissionIds.has(subm.id)) {
        const cls = classes.find(c => c.id === subm.class_id);
        const sub = subjects.find(s => s.id === subm.subject_id);
        const classStudents = (students || []).filter(s => (s.class_id === subm.class_id || s.classId === subm.class_id) && s.status !== 'inactive');
        list.push({
          key: subm.id,
          class_id: subm.class_id,
          className: cls?.name || subm.className || 'Class',
          section: cls?.section || subm.section || 'A',
          subject_id: subm.subject_id,
          subjectName: sub?.name || subm.subjectName || 'Subject',
          term: subm.term,
          teacherName: subm.teacher_name || 'Assigned Subject Teacher',
          submissionId: subm.id,
          status: subm.status || 'SUBMITTED',
          submittedAt: subm.submitted_at,
          returnedReason: subm.return_reason,
          lockedAt: subm.locked_at,
          totalStudents: classStudents.length || subm.total_students || 0,
          markedStudents: subm.marked_students || 0
        });
      }
    });

    return list;
  }, [classes, subjects, teacherSubjects, students, submissions, selectedTerm]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return fullRosterMatrix.filter(row => {
      if (filterClass !== 'ALL' && row.class_id !== filterClass) return false;
      if (filterStatus !== 'ALL') {
        if (filterStatus === 'SUBMITTED' && (row.status === 'SUBMITTED' || row.status === 'RESUBMITTED')) {
          // match
        } else if (row.status !== filterStatus) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = row.className.toLowerCase().includes(q) || 
                          row.subjectName.toLowerCase().includes(q) ||
                          row.teacherName.toLowerCase().includes(q) ||
                          row.term?.toLowerCase().includes(q);
        if (!matchName) return false;
      }
      return true;
    });
  }, [fullRosterMatrix, filterClass, filterStatus, searchQuery]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'LOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-sm">
            <Lock size={12} /> Locked
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950/80 text-blue-300 border border-blue-500/50 shadow-sm">
            <CheckCircle2 size={12} /> Approved
          </span>
        );
      case 'SUBMITTED':
      case 'RESUBMITTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/50 shadow-sm">
            <Clock size={12} /> Awaiting Review
          </span>
        );
      case 'RETURNED_FOR_CORRECTION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-500/50 shadow-sm">
            <RotateCcw size={12} /> Returned
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 shadow-sm">
            <FileText size={12} /> Draft
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800/80 text-slate-400 border border-slate-700">
            Not Started
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
            <ShieldCheck size={18} />
            <span>Academic Supervision & Quality Control</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Coordinator Marks Control Room
          </h1>
          <p className="text-sm text-slate-300 mt-0.5">
            Real-time verification, approval workflow, and report readiness tracking across all sections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/coordinator/reports')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer"
          >
            <Printer size={16} />
            <span>Report Printing Gatekeeper</span>
          </button>
          <button
            onClick={loadSubmissions}
            className="p-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Overview Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div 
          onClick={() => setFilterStatus('ALL')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            filterStatus === 'ALL'
              ? 'bg-indigo-950/60 border-indigo-500 text-white ring-2 ring-indigo-500/30'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
          }`}
        >
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Modules</div>
          <div className="text-2xl font-bold text-white mt-1">{overviewStats.total}</div>
        </div>

        <div 
          onClick={() => setFilterStatus('SUBMITTED')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            filterStatus === 'SUBMITTED'
              ? 'bg-amber-950/60 border-amber-500 text-amber-200 ring-2 ring-amber-500/30'
              : 'bg-slate-900 border-slate-800 hover:border-amber-500/50 text-slate-300'
          }`}
        >
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <Clock size={12} /> Awaiting Review
          </div>
          <div className="text-2xl font-bold text-amber-300 mt-1">{overviewStats.submitted}</div>
        </div>

        <div 
          onClick={() => setFilterStatus('APPROVED')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            filterStatus === 'APPROVED'
              ? 'bg-blue-950/60 border-blue-500 text-blue-200 ring-2 ring-blue-500/30'
              : 'bg-slate-900 border-slate-800 hover:border-blue-500/50 text-slate-300'
          }`}
        >
          <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 size={12} /> Approved
          </div>
          <div className="text-2xl font-bold text-blue-300 mt-1">{overviewStats.approved}</div>
        </div>

        <div 
          onClick={() => setFilterStatus('LOCKED')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            filterStatus === 'LOCKED'
              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/30'
              : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 text-slate-300'
          }`}
        >
          <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <Lock size={12} /> Locked
          </div>
          <div className="text-2xl font-bold text-emerald-300 mt-1">{overviewStats.locked}</div>
        </div>

        <div 
          onClick={() => setFilterStatus('RETURNED_FOR_CORRECTION')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            filterStatus === 'RETURNED_FOR_CORRECTION'
              ? 'bg-rose-50 border-rose-300 dark:bg-rose-950/40 dark:border-rose-700 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:border-rose-300'
          }`}
        >
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
            <RotateCcw size={12} /> Returned
          </div>
          <div className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">{overviewStats.returned}</div>
        </div>

        <div 
          onClick={() => setFilterStatus('DRAFT')}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            filterStatus === 'DRAFT'
              ? 'bg-slate-800 border-slate-500 text-white ring-2 ring-slate-500/30'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
          }`}
        >
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <FileText size={12} /> In Draft
          </div>
          <div className="text-2xl font-bold text-slate-200 mt-1">{overviewStats.draft}</div>
        </div>
      </div>

      {/* Cross-Term Pending Alert */}
      {otherTermAlert && (
        <div className="bg-amber-950/40 border border-amber-500/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 shadow-md">
          <div className="flex items-center gap-3">
            <Clock className="text-amber-400 shrink-0" size={20} />
            <div>
              <div className="text-sm font-bold text-amber-200">
                {otherTermAlert.count} Marksheet Submission(s) Awaiting Review in {otherTermAlert.label}
              </div>
              <div className="text-xs text-amber-300/80">
                You are currently viewing {selectedTerm === 'Midterm' ? 'Mid-Term Examination' : 'Final-Term Examination'}. Switch term to verify and approve.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedTerm(otherTermAlert.term)}
            className="self-start sm:self-auto px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition shadow shrink-0 cursor-pointer"
          >
            Switch to {otherTermAlert.label}
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {/* Academic Year */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-white text-sm font-medium focus:outline-none focus:border-indigo-500"
          >
            <option value="2026">Academic Year 2026-27</option>
            <option value="2025">Academic Year 2025-26</option>
          </select>

          {/* Term */}
          <select
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-white text-sm font-medium focus:outline-none focus:border-indigo-500"
          >
            <option value="Midterm">Mid-Term Examination</option>
            <option value="Finalterm">Final-Term Examination</option>
            <option value="ALL">All Terms (Mid & Final)</option>
          </select>

          {/* Class */}
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-white text-sm font-medium focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Classes</option>
            {classes?.map(c => (
              <option key={c.id} value={c.id}>{c.name} {c.section}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-white text-sm font-medium focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Awaiting Review (Submitted)</option>
            <option value="APPROVED">Approved (Ready to Lock)</option>
            <option value="LOCKED">Locked</option>
            <option value="RETURNED_FOR_CORRECTION">Returned for Correction</option>
            <option value="DRAFT">Draft</option>
            <option value="NOT_STARTED">Not Started</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search class, subject, teacher..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-800 text-slate-200 border-b border-slate-700 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4 text-slate-200 font-bold">Class & Section</th>
                <th className="py-3.5 px-4 text-slate-200 font-bold">Subject</th>
                <th className="py-3.5 px-4 text-slate-200 font-bold">Teacher</th>
                <th className="py-3.5 px-4 text-center text-slate-200 font-bold">Status</th>
                <th className="py-3.5 px-4 text-center text-slate-200 font-bold">Students Marked</th>
                <th className="py-3.5 px-4 text-right text-slate-200 font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 font-medium">
                    No subject marksheets match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => (
                  <tr 
                    key={row.key} 
                    className="hover:bg-slate-800/60 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {row.className} <span className="text-slate-400 font-normal">({row.section})</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-200 font-medium">
                      <div>{row.subjectName}</div>
                      {selectedTerm === 'ALL' && (
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                          {row.term === 'Midterm' ? 'Mid-Term' : 'Final-Term'}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {row.teacherName}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(row.status)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-bold text-slate-200">
                        {row.markedStudents}
                      </span>
                      {row.totalStudents > 0 && (
                        <span className="text-xs text-slate-400 ml-1 font-medium">
                          / {row.totalStudents}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {row.status !== 'NOT_STARTED' ? (
                        <button
                          onClick={() => {
                            if (row.submissionId) {
                              navigate(`/coordinator/review/${row.submissionId}`);
                            } else {
                              navigate(`/classes/${row.class_id}/subjects/${row.subject_id}`);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer"
                        >
                          <Eye size={14} />
                          <span>Review Marks</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/classes/${row.class_id}/subjects/${row.subject_id}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                        >
                          <span>Open Sheet</span>
                        </button>
                      )}
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
