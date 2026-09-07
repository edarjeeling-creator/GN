import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function HPCRevisionHistory() {
  const { profile } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role === 'admin' || profile?.role === 'principal') {
      fetchHistory();
    }
  }, [profile]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hpc_student_assessments')
        .select(`
          id, version, status, revision_reason, revision_requested_at,
          students(name, roll_no), hpc_terms(term_name), hpc_academic_years(year_name)
        `)
        .not('revision_reason', 'is', null)
        .order('revision_requested_at', { ascending: false });

      if (data) setHistory(data);
    } catch (error) {
      console.error('Error fetching revision history:', error);
    }
    setLoading(false);
  }

  if (profile?.role !== 'admin' && profile?.role !== 'principal') {
    return <div className="p-6">Access Denied.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">HPC Revision History</h1>
      
      <div className="bg-white p-6 rounded-lg shadow">
        {loading ? (
          <p>Loading history...</p>
        ) : history.length === 0 ? (
          <p className="text-gray-500">No revisions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Term</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map(item => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.revision_requested_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.students?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.hpc_terms?.term_name} ({item.hpc_academic_years?.year_name})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">v{item.version}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.revision_reason}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
