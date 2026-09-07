import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { resolveMarksTerm } from '../../utils/hpcMapping';
import HPCReportDocument from '../../components/HPCReportDocument';
import { formatStudentDisplayName } from '../../utils/studentUtils';
import html2pdf from 'html2pdf.js';

export default function HPCStudentProfile() {
  const { profile } = useAuth();
  const [assessmentData, setAssessmentData] = useState(null);
  const [marksData, setMarksData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marksLoading, setMarksLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  
  const reportRef = useRef(null);

  useEffect(() => {
    if (profile?.role === 'student') {
      fetchMyHPC();
    }
  }, [profile]);

  async function fetchMyHPC() {
    setLoading(true);
    try {
      // Call the new SECURITY DEFINER RPC. Passing null for year and term fetches the latest published HPC.
      const { data, error } = await supabase.rpc('get_student_hpc_report', {
        p_uid: profile.uid || profile.admission_number || profile.id, // Fallback to id if uid is not in profile, though unifiedLogin uses uid
        p_academic_year: null,
        p_term: null
      });
      
      if (error) {
        console.error('Error fetching student HPC via RPC:', error);
      } else if (data && data.assessment) {
        // Map the flat RPC response back to the expected nested structure for the UI
        const mappedData = {
          ...data.assessment,
          students: {
            ...data.student,
            classes: {
              name: data.student.class,
              section: data.student.section
            }
          },
          hpc_academic_years: { year_name: data.assessment.academic_year },
          hpc_terms: { term_name: data.assessment.term },
          hpc_competency_ratings: data.competencies.map(c => ({
            id: c.competency_name,
            teacher_comment: c.teacher_comment,
            hpc_competencies: { name: c.competency_name, category: c.category },
            hpc_rating_scale_levels: { level_name: c.rating_description, color_code: c.color_code || '#ccc' }
          })),
          hpc_outcome_ratings: data.learning_outcomes.map(o => ({
            id: o.outcome_code,
            teacher_comment: o.teacher_comment,
            hpc_learning_outcomes: { outcome_code: o.outcome_code, outcome_text: o.outcome_text },
            hpc_rating_scale_levels: { level_name: o.rating_description }
          })),
          self_ratings: data.self_ratings || []
        };

        setAssessmentData(mappedData);
        
        // Map marks to expected format
        const mappedMarks = data.marks.map(m => ({
          score: m.score,
          subjects: { name: m.subject_name }
        }));
        setMarksData(mappedMarks);
      }
    } catch (error) {
      console.error('Exception fetching HPC:', error);
    } finally {
      setLoading(false);
      setMarksLoading(false);
    }
  }

  const generatePDF = () => {
    if (!assessmentData || !reportRef.current) return;
    setPdfGenerating(true);

    const studentName = formatStudentDisplayName(assessmentData.students?.name)?.replace(/\s+/g, '_') || 'Student';
    const academicYear = assessmentData.hpc_academic_years?.year_name || 'Year';
    const term = assessmentData.hpc_terms?.term_name || 'Term';
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
      console.error('PDF Generation Error:', err);
      setPdfGenerating(false);
    });
  };

  if (profile?.role !== 'student') {
    return <div className="p-6">Access Denied. Student only view.</div>;
  }

  if (loading) {
    return <div className="p-6">Loading your progress card...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">My 360° Progress Card</h1>
        {assessmentData && (
          <button 
            onClick={generatePDF} 
            disabled={pdfGenerating}
            className={`px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition ${pdfGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {pdfGenerating ? 'Generating PDF...' : 'Download 360° Report'}
          </button>
        )}
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        {assessmentData ? (
          <div className="space-y-8">
            <div className="border-b pb-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                {assessmentData.hpc_terms?.term_name} - {assessmentData.hpc_academic_years?.year_name}
              </h2>
              {assessmentData.version && (
                <span className="bg-gray-100 text-gray-800 text-sm px-2 py-1 rounded">
                  Version {assessmentData.version}
                </span>
              )}
            </div>
            
            {/* Academic Performance UI */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Academic Performance</h3>
              {marksLoading ? (
                <p className="text-gray-500 italic">Loading academic performance...</p>
              ) : marksData === null ? (
                <p className="text-red-500">Unable to load academic performance.</p>
              ) : marksData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {marksData.map((mark, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{mark.subjects?.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{mark.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 italic">Academic marks for this assessment period are not available in the ERP.</p>
              )}
            </div>

            {/* Competency Development UI */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Competency Development</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assessmentData.hpc_competency_ratings?.map(cr => (
                  <div key={cr.id} className="border p-4 rounded-md">
                    <h4 className="font-medium text-gray-900">{cr.hpc_competencies?.name}</h4>
                    <p className="text-sm text-gray-500 mb-2">{cr.hpc_competencies?.category}</p>
                    <div className="flex items-center space-x-2">
                      <span className="inline-block w-3 h-3 rounded-full" style={{backgroundColor: cr.hpc_rating_scale_levels?.color_code || '#ccc'}}></span>
                      <span className="font-semibold">{cr.hpc_rating_scale_levels?.level_name}</span>
                    </div>
                    {cr.teacher_comment && <p className="text-sm mt-2 italic text-gray-600">"{cr.teacher_comment}"</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Learning Outcomes UI */}
            {assessmentData.hpc_outcome_ratings && assessmentData.hpc_outcome_ratings.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Learning Outcomes</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Outcome</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {assessmentData.hpc_outcome_ratings.map(or => (
                        <tr key={or.id}>
                          <td className="px-4 py-2 text-sm font-mono text-gray-500">{or.hpc_learning_outcomes?.outcome_code}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{or.hpc_learning_outcomes?.outcome_text}</td>
                          <td className="px-4 py-2 text-sm font-medium">{or.hpc_rating_scale_levels?.level_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Teacher's Holistic Comment UI */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Teacher's Holistic Comment</h3>
              <p className="text-gray-700 bg-gray-50 p-4 rounded border border-gray-200">
                {assessmentData.overall_comment || 'No comment provided.'}
              </p>
            </div>

            {/* Student Self-Assessment Feedback UI */}
            {assessmentData.self_ratings && assessmentData.self_ratings.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">My Self-Assessment Reflections</h3>
                <div className="space-y-4">
                  {assessmentData.self_ratings.map((sr, idx) => (
                    <div key={idx} className="bg-blue-50 p-4 rounded border border-blue-100">
                      <p className="text-sm font-semibold text-blue-900">Competency Reflection</p>
                      <p className="text-gray-700 mt-1">{sr.comment || 'No additional comments.'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No HPC Available</h3>
            <p className="mt-1 text-sm text-gray-500">Your progress card has not been published yet.</p>
          </div>
        )}
      </div>

      {/* Hidden PDF Document Template */}
      {assessmentData && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', zIndex: -1000 }}>
          <HPCReportDocument 
            ref={reportRef} 
            studentName={formatStudentDisplayName(assessmentData.students?.name)}
            admissionNo={assessmentData.students?.roll_no}
            className={assessmentData.students?.classes?.name}
            section={assessmentData.students?.classes?.section}
            assessmentData={assessmentData}
            marksData={marksData}
          />
        </div>
      )}
    </div>
  );
}
