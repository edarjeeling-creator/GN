import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { resolveMarksTerm } from '../../utils/hpcMapping';
import HPCReportDocument from '../../components/HPCReportDocument';
import { formatStudentDisplayName } from '../../utils/studentUtils';
import html2pdf from 'html2pdf.js';

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
  
  const reportRef = useRef(null);

  useEffect(() => {
    if (profile?.role === 'principal' || profile?.role === 'admin') {
      fetchAssessments();
    }
  }, [profile, statusFilter]);

  async function fetchAssessments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hpc_student_assessments')
        .select('*, students(name, roll_no), classes(name, section), hpc_terms(term_name)')
        .eq('status', statusFilter)
        .order('updated_at', { ascending: false });
      
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
          hpc_outcome_ratings(*, hpc_learning_outcomes(*), hpc_rating_scale_levels(*))
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
    try {
      const updates = { status: newStatus };
      if (newStatus === 'approved') updates.approved_at = new Date().toISOString();
      if (newStatus === 'published') updates.published_at = new Date().toISOString();
      
      await supabase
        .from('hpc_student_assessments')
        .update(updates)
        .eq('id', selectedId);
        
      closeModal();
      fetchAssessments();
    } catch (error) {
      console.error('Error changing status:', error);
    }
  }

  const generatePDF = () => {
    if (!modalData || !reportRef.current) return;
    setPdfGenerating(true);

    const studentName = formatStudentDisplayName(modalData.students?.name)?.replace(/\s+/g, '_') || 'Student';
    const academicYear = modalData.hpc_academic_years?.year_name || 'Year';
    const term = modalData.hpc_terms?.term_name || 'Term';
    const filename = `HPC_${studentName}_${academicYear}_${term}.pdf`;

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

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">HPC Review & Moderation</h1>
          <p className="text-sm text-gray-500 mt-1">Review, approve, reject, or revise holistic progress cards submitted by teachers</p>
        </div>
        
        {/* Status Filter */}
        <div className="flex space-x-2">
          {['under_review', 'approved', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded font-medium text-sm capitalize transition ${
                statusFilter === status 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-white border text-gray-700 hover:bg-gray-50'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Assessment List */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading assessments...</div>
        ) : assessments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No assessments found with status: <strong>{statusFilter}</strong></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Term</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assessments.map(a => (
                  <tr key={a.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatStudentDisplayName(a.students?.name)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{a.classes?.name} {a.classes?.section}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{a.hpc_terms?.term_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">v{a.version || 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-4">
                      <button onClick={() => openModal(a.id)} className="text-blue-600 hover:text-blue-900">View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Modal */}
      {selectedId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 font-bold text-xl">&times;</button>
            
            {modalLoading ? (
              <p>Loading details...</p>
            ) : modalData ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold border-b pb-2">
                  Review: {formatStudentDisplayName(modalData.students?.name)} - {modalData.hpc_terms?.term_name}
                </h2>
                
                <div className="bg-gray-50 p-4 rounded text-sm">
                  <p><strong>Status:</strong> <span className="uppercase">{modalData.status}</span></p>
                  <p><strong>Version:</strong> {modalData.version || 1}</p>
                  <p><strong>Class:</strong> {modalData.students?.classes?.name} {modalData.students?.classes?.section}</p>
                  <p><strong>Teacher Remarks:</strong> {modalData.general_remarks || 'None'}</p>
                </div>

                {/* Holistic Competency Ratings */}
                <div>
                  <h3 className="text-lg font-bold mb-2">Competency Ratings</h3>
                  {modalData.hpc_assessment_competencies?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {modalData.hpc_assessment_competencies.map(cr => (
                        <div key={cr.id} className="border p-3 rounded-lg bg-gray-50">
                          <p className="font-semibold text-gray-800">{cr.hpc_competencies?.name}</p>
                          <p className="text-sm text-gray-500">{cr.hpc_competencies?.category}</p>
                          <div className="mt-2 inline-block px-2 py-1 text-xs font-semibold rounded text-white" style={{ backgroundColor: cr.hpc_rating_scale_levels?.color_code || '#6B7280' }}>
                            {cr.hpc_rating_scale_levels?.level_name}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No competency evaluations recorded.</p>
                  )}
                </div>

                {/* Actions & Decision */}
                <div className="flex flex-wrap gap-4 pt-4 border-t justify-end items-center">
                  <button
                    onClick={generatePDF}
                    disabled={pdfGenerating}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition flex items-center gap-2"
                  >
                    {pdfGenerating ? 'Generating PDF...' : 'Download / Print PDF'}
                  </button>

                  {modalData.status === 'under_review' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus('approved')}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Approve HPC
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('rejected')}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {modalData.status === 'approved' && (
                    <button
                      onClick={async () => {
                        const reason = prompt("Enter reason for revision:");
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
                      className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                    >
                      Create Revision
                    </button>
                  )}
                </div>

                {/* Render the hidden document for printing */}
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
              </div>
            ) : (
              <p className="text-red-500">Failed to load data.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
