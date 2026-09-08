import React from 'react';
import { formatStudentDisplayName } from '../utils/studentUtils';

/**
 * A dedicated component for rendering the HPC as a printable A4 PDF Document.
 * This should be rendered off-screen and passed to html2pdf.js.
 */
const HPCReportDocument = React.forwardRef(({ studentName, admissionNo, className, section, assessmentData, marksData }, ref) => {
  return (
    <div ref={ref} className="bg-white p-8 w-[210mm] min-h-[297mm] mx-auto text-gray-900" style={{ fontFamily: 'sans-serif' }}>
      
      {/* School Header */}
      <div className="text-center border-b-2 border-gray-800 pb-4 mb-6 relative">
        <h1 className="text-2xl font-bold uppercase tracking-wider">Gyanoday Niketan</h1>
        <p className="text-sm text-gray-600">360° Holistic Progress Card</p>
        <span className="absolute top-0 right-0 bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded">
          v{assessmentData?.version || 1}
        </span>
      </div>

      {/* Student Information */}
      <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
        <div>
          <p><span className="font-semibold">Student Name:</span> {formatStudentDisplayName(studentName)}</p>
          {admissionNo && <p><span className="font-semibold">Admission No:</span> {admissionNo}</p>}
        </div>
        <div className="text-right">
          <p><span className="font-semibold">Class:</span> {className} {section}</p>
          <p><span className="font-semibold">Academic Period:</span> {assessmentData?.hpc_academic_years?.year_name} - {assessmentData?.hpc_terms?.term_name}</p>
        </div>
      </div>

      {/* Academic Performance */}
      <div className="mb-8">
        <h2 className="text-lg font-bold border-b pb-2 mb-4 uppercase text-gray-800">Academic Performance</h2>
        {marksData && marksData.length > 0 ? (
          <table className="w-full text-sm text-left border-collapse border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-4 py-2">Subject</th>
                <th className="border border-gray-300 px-4 py-2 w-32 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {marksData.map((mark, idx) => (
                <tr key={idx}>
                  <td className="border border-gray-300 px-4 py-2 font-medium">{mark.subjects?.name}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{mark.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500 italic">Academic marks for this assessment period are not available in the ERP.</p>
        )}
      </div>

      {/* Competency Development */}
      <div className="mb-8">
        <h2 className="text-lg font-bold border-b pb-2 mb-4 uppercase text-gray-800">Competency Development</h2>
        <div className="grid grid-cols-2 gap-4">
          {assessmentData?.hpc_competency_ratings?.map(cr => (
            <div key={cr.id} className="border border-gray-200 p-3 rounded text-sm break-inside-avoid">
              <h4 className="font-bold text-gray-800">{cr.hpc_competencies?.name}</h4>
              <p className="text-xs text-gray-500 mb-2">{cr.hpc_competencies?.category}</p>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-gray-900">{cr.hpc_rating_scale_levels?.level_name}</span>
              </div>
              {cr.teacher_comment && <p className="text-xs mt-1 italic text-gray-600">"{cr.teacher_comment}"</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Learning Outcomes */}
      {assessmentData?.hpc_outcome_ratings && assessmentData.hpc_outcome_ratings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold border-b pb-2 mb-4 uppercase text-gray-800">Learning Outcomes</h2>
          <table className="w-full text-sm text-left border-collapse border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-3 py-2">Code</th>
                <th className="border border-gray-300 px-3 py-2">Outcome</th>
                <th className="border border-gray-300 px-3 py-2">Rating</th>
              </tr>
            </thead>
            <tbody>
              {assessmentData.hpc_outcome_ratings.map(or => (
                <tr key={or.id} className="break-inside-avoid">
                  <td className="border border-gray-300 px-3 py-2 text-xs font-mono">{or.hpc_learning_outcomes?.outcome_code}</td>
                  <td className="border border-gray-300 px-3 py-2 text-sm">{or.hpc_learning_outcomes?.outcome_text}</td>
                  <td className="border border-gray-300 px-3 py-2 font-medium">{or.hpc_rating_scale_levels?.level_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Teacher's Holistic Comment */}
      <div className="mb-6 break-inside-avoid">
        <h2 className="text-lg font-bold border-b pb-2 mb-3 uppercase text-gray-800">1. Teacher's Holistic Observation</h2>
        <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded border border-gray-200">
          {assessmentData?.framework_snapshot?.teacher_remarks || assessmentData?.overall_comment || 'No specific comment provided.'}
        </p>
      </div>

      {/* Student Self-Reflection */}
      {((assessmentData?.self_ratings && assessmentData.self_ratings.length > 0) || 
        (assessmentData?.hpc_student_self_ratings && assessmentData.hpc_student_self_ratings.length > 0)) && (
        <div className="mb-6 break-inside-avoid">
          <h2 className="text-lg font-bold border-b pb-2 mb-3 uppercase text-amber-900">2. Student Self-Reflection (Student's Voice)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(assessmentData.self_ratings || assessmentData.hpc_student_self_ratings).map((sr, idx) => (
              <div key={idx} className="bg-amber-50/50 p-3 rounded border border-amber-200 text-xs">
                <p className="font-bold text-amber-900">{sr.hpc_competencies?.name || sr.competency_name || 'Competency Reflection'}</p>
                {sr.hpc_rating_scale_levels?.level_name && (
                  <p className="font-semibold text-gray-800 mt-0.5">Rating: {sr.hpc_rating_scale_levels.level_name}</p>
                )}
                {sr.student_comment && <p className="italic text-gray-700 mt-1">"{sr.student_comment}"</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Peer Assessment */}
      {assessmentData?.framework_snapshot?.peer_assessment?.peerName && (
        <div className="mb-6 break-inside-avoid">
          <h2 className="text-lg font-bold border-b pb-2 mb-3 uppercase text-emerald-900">3. Peer Assessment (Collaborative Learning)</h2>
          <div className="bg-emerald-50/50 p-4 rounded border border-emerald-200 text-sm">
            <p className="font-semibold text-emerald-900 mb-1">
              Feedback from Classmate: <span className="font-bold text-gray-900">{assessmentData.framework_snapshot.peer_assessment.peerName}</span>
            </p>
            {assessmentData.framework_snapshot.peer_assessment.strengths && (
              <p className="text-xs text-gray-700 mb-1">
                <span className="font-bold">Collaborative Strengths:</span> {assessmentData.framework_snapshot.peer_assessment.strengths}
              </p>
            )}
            {assessmentData.framework_snapshot.peer_assessment.comment && (
              <p className="text-xs italic text-gray-800 mt-1">
                "{assessmentData.framework_snapshot.peer_assessment.comment}"
              </p>
            )}
          </div>
        </div>
      )}

      {/* Parent Reflection */}
      {(assessmentData?.hpc_parent_reflections || assessmentData?.framework_snapshot?.parent_reflection) && (
        <div className="mb-8 break-inside-avoid">
          <h2 className="text-lg font-bold border-b pb-2 mb-3 uppercase text-purple-900">4. Parent Reflection (Home Observations)</h2>
          {(() => {
            const pr = assessmentData.hpc_parent_reflections || assessmentData.framework_snapshot?.parent_reflection || {};
            return (
              <div className="bg-purple-50/50 p-4 rounded border border-purple-200 text-xs space-y-2">
                {pr.strength_observed && (
                  <p><span className="font-bold text-purple-900">Strengths Observed at Home:</span> {pr.strength_observed}</p>
                )}
                {pr.area_requiring_support && (
                  <p><span className="font-bold text-purple-900">Areas Requiring Support:</span> {pr.area_requiring_support}</p>
                )}
                {pr.interest_talent && (
                  <p><span className="font-bold text-purple-900">Special Interests & Talents:</span> {pr.interest_talent}</p>
                )}
                {pr.parent_comment && (
                  <p><span className="font-bold text-purple-900">Parent Feedback / Note:</span> {pr.parent_comment}</p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Approval Information */}
      <div className="grid grid-cols-2 gap-8 mt-16 pt-8 border-t border-gray-800 break-inside-avoid text-sm">
        <div className="text-center">
          <div className="h-8 border-b border-gray-400 mb-2 w-48 mx-auto"></div>
          <p className="font-semibold text-gray-800">Class Teacher Signature</p>
        </div>
        <div className="text-center">
          <div className="h-8 border-b border-gray-400 mb-2 w-48 mx-auto"></div>
          <p className="font-semibold text-gray-800">Principal Signature</p>
        </div>
      </div>
      
      <div className="text-center mt-8 text-xs text-gray-400">
        <p>Published on: {new Date(assessmentData?.published_at || assessmentData?.updated_at).toLocaleDateString()}</p>
        <p>Official 360° Holistic Progress Card generated by School ERP</p>
      </div>

    </div>
  );
});

export default HPCReportDocument;
