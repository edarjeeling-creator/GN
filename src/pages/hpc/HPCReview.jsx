import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { resolveMarksTerm } from '../../utils/hpcMapping';
import HPCReportDocument from '../../components/HPCReportDocument';
import { formatStudentDisplayName } from '../../utils/studentUtils';
import html2pdf from 'html2pdf.js';
import { 
  CheckCircle, 
  XCircle, 
  Send, 
  Download, 
  Clock, 
  BookOpen, 
  Sparkles, 
  Users, 
  Heart,
  Eye,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export default function HPCReview() {
  const { profile } = useAuth();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('under_review');
  
  // Modal State
  const [selectedId, setSelectedId] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [modalMarks, setModalMarks] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const reportRef = useRef(null);

  useEffect(() => {
    if (profile?.role === 'principal' || profile?.role === 'admin') {
      fetchAssessments();
    }
  }, [profile, statusFilter]);

  async function fetchAssessments() {
    setLoading(true);
    try {
      let query = supabase
        .from('hpc_student_assessments')
        .select('*, students(name, roll_no), classes(name, section), hpc_terms(term_name), hpc_academic_years(year_name)');

      if (statusFilter === 'under_review') {
        query = query.in('status', ['under_review', 'submitted']);
      } else {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });
      
      if (data) setAssessments(data);
    } catch (error) {
      console.error('Error fetching assessments for review:', error);
    }
    setLoading(false);
  }

  async function openModal(id) {
    setSelectedId(id);
    setModalLoading(true);
    try {
      const { data, error } = await supabase
        .from('hpc_student_assessments')
        .select(`
          *,
          students(name, roll_no, classes(name, section)),
          hpc_academic_years(year_name),
          hpc_terms(term_name),
          hpc_competency_ratings(*, hpc_competencies(*), hpc_rating_scale_levels(*)),
          hpc_outcome_ratings(*, hpc_learning_outcomes(*), hpc_rating_scale_levels(*)),
          hpc_student_self_ratings(*, hpc_competencies(*), hpc_rating_scale_levels(*)),
          hpc_parent_reflections(*)
        `)
        .eq('id', id)
        .single();
        
      if (data) {
        setModalData(data);
        const marksTerm = resolveMarksTerm(data.hpc_academic_years?.year_name, data.hpc_terms?.term_name);
        if (marksTerm) {
          const { data: mData } = await supabase
            .from('marks')
            .select('score, subjects(name)')
            .eq('student_id', data.student_id)
            .eq('term', marksTerm);
          setModalMarks(mData || []);
        } else {
          setModalMarks([]);
        }
      }
    } catch (error) {
      console.error('Error fetching full assessment details:', error);
    }
    setModalLoading(false);
  }

  function closeModal() {
    setSelectedId(null);
    setModalData(null);
    setModalMarks(null);
  }

  async function changeStatus(newStatus) {
    if (!selectedId) return;
    setActionLoading(true);
    try {
      const currentStatus = modalData?.status || 'under_review';
      const now = new Date().toISOString();

      // Follow Postgres trigger transition rules
      if (newStatus === 'published') {
        // If coming from under_review or submitted, must transition through approved first
        if (currentStatus === 'under_review' || currentStatus === 'submitted') {
          await supabase
            .from('hpc_student_assessments')
            .update({ status: 'approved', approved_at: now })
            .eq('id', selectedId);
        }
        
        await supabase
          .from('hpc_student_assessments')
          .update({ status: 'published', published_at: now })
          .eq('id', selectedId);

      } else if (newStatus === 'approved') {
        await supabase
          .from('hpc_student_assessments')
          .update({ status: 'approved', approved_at: now })
          .eq('id', selectedId);

      } else if (newStatus === 'returned') {
        const reason = prompt("Enter notes / reason for returning to teacher for revisions:");
        await supabase
          .from('hpc_student_assessments')
          .update({ 
            status: 'returned', 
            revision_reason: reason || 'Revision requested by reviewer' 
          })
          .eq('id', selectedId);
      }
        
      closeModal();
      fetchAssessments();
    } catch (error) {
      console.error('Error changing status:', error);
      alert('Status update failed: ' + error.message);
    }
    setActionLoading(false);
  }

  const generatePDF = () => {
    if (!modalData || !reportRef.current) return;
    setPdfGenerating(true);

    const studentName = formatStudentDisplayName(modalData.students?.name)?.replace(/\s+/g, '_') || 'Student';
    const academicYear = modalData.hpc_academic_years?.year_name || 'Year';
    const term = modalData.hpc_terms?.term_name || 'Term';
    const filename = `HPC_360_${studentName}_${academicYear}_${term}.pdf`;

    const opt = {
      margin:       10,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(reportRef.current).save().then(() => {
      setPdfGenerating(false);
    }).catch(err => {
      console.error(err);
      alert('Failed to generate PDF');
      setPdfGenerating(false);
    });
  };

  if (profile?.role !== 'principal' && profile?.role !== 'admin') {
    return <div className="p-6">Access Denied. Principal or Admin only.</div>;
  }

  const statusTabs = [
    { key: 'under_review', label: 'Under Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'published', label: 'Published' },
    { key: 'returned', label: 'Returned' }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">360° HPC Review & Moderation</h1>
          <p className="text-sm text-gray-600 mt-1">
            Review, moderate, approve, and officially publish Holistic Progress Cards submitted by teachers
          </p>
        </div>
        
        {/* Status Filter */}
        <div className="flex flex-wrap gap-2">
          {statusTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 rounded-lg font-semibold text-xs transition border ${
                statusFilter === tab.key 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assessment List */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p>Loading assessments for moderation...</p>
          </div>
        ) : assessments.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Clock className="mx-auto h-10 w-10 text-gray-400 mb-2" />
            <p className="font-semibold text-sm">No assessments currently with status: <strong>{statusFilter.replace('_', ' ')}</strong></p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase">Student Name</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase">Class</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase">Academic Period</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase">Status</th>
                  <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assessments.map(a => (
                  <tr key={a.id} className="hover:bg-blue-50/40 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {formatStudentDisplayName(a.students?.name)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {a.classes?.name} {a.classes?.section}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {a.hpc_terms?.term_name} ({a.hpc_academic_years?.year_name})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 uppercase">
                        {a.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <button 
                        onClick={() => openModal(a.id)} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Moderate & Decide
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Moderation Details Modal */}
      {selectedId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Moderate HPC: {formatStudentDisplayName(modalData?.students?.name)}
                </h2>
                <p className="text-xs text-slate-300">
                  {modalData?.classes?.name} {modalData?.classes?.section} • {modalData?.hpc_terms?.term_name} ({modalData?.hpc_academic_years?.year_name})
                </p>
              </div>
              <button 
                onClick={closeModal} 
                className="text-slate-400 hover:text-white p-1 rounded-md transition text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
              {modalLoading ? (
                <div className="py-12 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                  <p>Loading full 360° evaluation details...</p>
                </div>
              ) : modalData ? (
                <div className="space-y-6">
                  
                  {/* Status Banner */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase block">Current Status</span>
                      <span className="font-bold text-gray-900 uppercase text-base">{modalData.status}</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase block">Version</span>
                      <span className="font-bold text-gray-900 text-base">v{modalData.version || 1}</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase block">Submitted At</span>
                      <span className="text-gray-700 text-xs">
                        {modalData.submitted_at ? new Date(modalData.submitted_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>

                  {/* 1. Teacher Evaluation */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      Teacher's Competency Ratings ({modalData.hpc_competency_ratings?.length || 0})
                    </h3>
                    
                    {modalData.hpc_competency_ratings?.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {modalData.hpc_competency_ratings.map(cr => (
                          <div key={cr.id} className="border border-gray-200 p-3 rounded-lg bg-gray-50/50 text-xs">
                            <p className="font-bold text-gray-900">{cr.hpc_competencies?.name}</p>
                            <p className="text-[11px] text-gray-500">{cr.hpc_competencies?.category}</p>
                            <div className="mt-1.5 inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-full text-white" style={{ backgroundColor: cr.hpc_rating_scale_levels?.color_code || '#3b82f6' }}>
                              {cr.hpc_rating_scale_levels?.level_name}
                            </div>
                            {cr.teacher_comment && <p className="italic text-gray-600 mt-1">"{cr.teacher_comment}"</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">No competency evaluations recorded.</p>
                    )}

                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-bold text-gray-700">Teacher's Holistic Remark:</p>
                      <p className="text-xs text-gray-800 bg-gray-50 p-2.5 rounded mt-1">
                        {modalData.framework_snapshot?.teacher_remarks || modalData.overall_comment || 'None recorded.'}
                      </p>
                    </div>
                  </div>

                  {/* 2. Student Self-Reflection */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Student Self-Reflection
                    </h3>
                    {modalData.hpc_student_self_ratings?.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {modalData.hpc_student_self_ratings.map((sr, idx) => (
                          <div key={idx} className="bg-amber-50/50 p-3 rounded-lg border border-amber-200 text-xs">
                            <p className="font-bold text-amber-900">{sr.hpc_competencies?.name}</p>
                            <p className="font-semibold text-gray-800 mt-0.5">Rating: {sr.hpc_rating_scale_levels?.level_name}</p>
                            {sr.student_comment && <p className="italic text-gray-700 mt-1">"{sr.student_comment}"</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">No student self-reflection submitted online.</p>
                    )}
                  </div>

                  {/* 3. Peer Assessment */}
                  {modalData.framework_snapshot?.peer_assessment?.peerName && (
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-2">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-600" />
                        Peer Assessment
                      </h3>
                      <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-200 text-xs">
                        <p className="font-bold text-emerald-900">
                          Classmate: {modalData.framework_snapshot.peer_assessment.peerName}
                        </p>
                        {modalData.framework_snapshot.peer_assessment.strengths && (
                          <p className="text-gray-700 mt-0.5">Strengths: {modalData.framework_snapshot.peer_assessment.strengths}</p>
                        )}
                        {modalData.framework_snapshot.peer_assessment.comment && (
                          <p className="italic text-gray-800 mt-1">"{modalData.framework_snapshot.peer_assessment.comment}"</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 4. Parent Reflection */}
                  {(modalData.hpc_parent_reflections?.[0] || modalData.framework_snapshot?.parent_reflection) && (
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-2">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-purple-600" />
                        Parent Reflection
                      </h3>
                      {(() => {
                        const pr = modalData.hpc_parent_reflections?.[0] || modalData.framework_snapshot?.parent_reflection || {};
                        return (
                          <div className="bg-purple-50/50 p-3.5 rounded-lg border border-purple-200 text-xs space-y-1.5">
                            {pr.strength_observed && <p><span className="font-bold text-purple-900">Home Strengths:</span> {pr.strength_observed}</p>}
                            {pr.area_requiring_support && <p><span className="font-bold text-purple-900">Areas for Support:</span> {pr.area_requiring_support}</p>}
                            {pr.interest_talent && <p><span className="font-bold text-purple-900">Special Interests:</span> {pr.interest_talent}</p>}
                            {pr.parent_comment && <p><span className="font-bold text-purple-900">Parent Feedback:</span> {pr.parent_comment}</p>}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                </div>
              ) : null}
            </div>

            {/* Modal Footer / Moderation Decisions */}
            <div className="px-6 py-4 bg-white border-t border-gray-200 flex flex-wrap justify-between items-center gap-3">
              <button
                onClick={generatePDF}
                disabled={pdfGenerating}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                {pdfGenerating ? 'Generating...' : 'Preview Report PDF'}
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>

                {modalData?.status !== 'returned' && modalData?.status !== 'published' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => changeStatus('returned')}
                    className="px-3.5 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
                  >
                    Return for Revision
                  </button>
                )}

                {(modalData?.status === 'under_review' || modalData?.status === 'submitted') && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => changeStatus('approved')}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Assessment
                  </button>
                )}

                {modalData?.status !== 'published' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => changeStatus('published')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    Publish 360° Card
                  </button>
                )}

                {modalData?.status === 'published' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const reason = prompt("Enter reason for creating a new revision:");
                      if (reason) {
                        const { data, error } = await supabase.rpc('create_hpc_revision', {
                          p_assessment_id: modalData.id,
                          p_reason: reason
                        });
                        if (data?.success) {
                          alert("Revision Created Successfully.");
                          closeModal();
                          fetchAssessments();
                        } else {
                          alert("Failed to create revision: " + (data?.message || error?.message));
                        }
                      }
                    }}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Create New Revision
                  </button>
                )}
              </div>
            </div>

            {/* Hidden Printable Document for PDF Preview */}
            {modalData && (
              <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', zIndex: -1000 }}>
                <HPCReportDocument 
                  ref={reportRef} 
                  studentName={formatStudentDisplayName(modalData.students?.name)}
                  admissionNo={modalData.students?.roll_no}
                  className={modalData.students?.classes?.name}
                  section={modalData.students?.classes?.section}
                  assessmentData={modalData}
                  marksData={modalMarks}
                />
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
