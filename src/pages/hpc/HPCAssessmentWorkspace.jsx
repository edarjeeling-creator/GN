import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { formatStudentDisplayName } from '../../utils/studentUtils';

export default function HPCAssessmentWorkspace() {
  const { profile } = useAuth();
  const { classes } = useData();
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents(selectedClass);
    }
  }, [selectedClass]);

  async function fetchStudents(classId) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, hpc_student_assessments(*)')
        .eq('class_id', classId)
        .order('roll_no');
      
      if (data) setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
    setLoading(false);
  }

  // Find classes where teacher is either class teacher or subject teacher
  const assignedClasses = classes?.filter(c => 
    c.class_teacher_id === profile?.id || 
    c.teacher_subjects?.some(ts => ts.teacher_id === profile?.id)
  ) || [];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">HPC Assessment Workspace</h1>
      
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
          <select 
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            value={selectedClass || ''}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">-- Select a class --</option>
            {assignedClasses.map(c => (
              <option key={c.id} value={c.id}>{c.name} {c.section}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p>Loading students...</p>
        ) : selectedClass ? (
          <div>
            <h2 className="text-xl font-semibold mb-4">Students</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assessment Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map(student => {
                    const assessment = student.hpc_student_assessments?.[0];
                    return (
                      <tr key={student.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.roll_no}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatStudentDisplayName(student.name)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${assessment?.status === 'published' ? 'bg-green-100 text-green-800' : 
                              assessment?.status === 'under_review' ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-gray-100 text-gray-800'}`}>
                            {assessment?.status || 'Not Started'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:text-blue-900 cursor-pointer">
                          Assess
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-gray-500">Select a class to view students and begin assessments.</p>
            <div className="mt-8 p-4 bg-blue-50 text-blue-800 rounded">
              <h3 className="font-semibold">Phase 3 Features Enabled</h3>
              <ul className="list-disc pl-5 mt-2 text-sm">
                <li>Domain Hierarchy: Assessments now follow Framework &rarr; Domain &rarr; Competency &rarr; Indicator.</li>
                <li>Portfolio Evidence: You can now upload artifacts to support competency ratings.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
