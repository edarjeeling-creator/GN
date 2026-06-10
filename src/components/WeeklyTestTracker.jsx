import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, Clock, AlertTriangle, Printer, UserX, Trophy } from 'lucide-react';

export default function WeeklyTestTracker() {
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [testMarks, setTestMarks] = useState([]);
  const [passPercentage, setPassPercentage] = useState(40);

  useEffect(() => {
    fetchTests();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'weekly_test_pass_percentage').single();
    if (data) {
      setPassPercentage(Number(data.value));
    }
  };

  const fetchTests = async () => {
    const { data } = await supabase
      .from('weekly_tests')
      .select(`
        *,
        classes(name),
        subjects(name),
        profiles(name)
      `)
      .order('created_at', { ascending: false });
    if (data) setTests(data);
  };

  const viewReport = async (test) => {
    setSelectedTest(test);
    const { data } = await supabase
      .from('weekly_test_marks')
      .select(`
        *,
        students(roll_no, name)
      `)
      .eq('test_id', test.id)
      .order('score', { ascending: false, nullsFirst: false });
    
    if (data) {
      // Calculate Ranks and Results
      let currentRank = 1;
      let previousScore = -1;
      
      const processedMarks = data.map((m, index) => {
        if (m.is_absent) {
          return { ...m, rank: '-', result: 'Absent', percentage: 0 };
        }
        
        const percentage = ((m.score / test.max_marks) * 100).toFixed(1);
        const result = percentage >= passPercentage ? 'Pass' : 'Fail';
        
        if (previousScore !== -1 && m.score < previousScore) {
           currentRank = index + 1; // standard competition ranking (e.g. 1, 1, 3)
           // If we just want 1, 1, 2, we would do currentRank++
        }
        previousScore = m.score;
        
        return { ...m, rank: currentRank, result, percentage };
      });

      setTestMarks(processedMarks);
    }
  };

  const approveTest = async () => {
    if(!selectedTest) return;
    const { error } = await supabase
      .from('weekly_tests')
      .update({ status: 'Approved' })
      .eq('id', selectedTest.id);
    
    if (!error) {
      alert('Test Approved successfully!');
      setSelectedTest(null);
      fetchTests();
    }
  };

  if (selectedTest) {
    const topPerformers = testMarks.filter(m => m.rank >= 1 && m.rank <= 3 && !m.is_absent);
    const requiresAttention = testMarks.filter(m => m.result === 'Fail' || m.is_absent);

    return (
      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
             <h2 className="text-2xl font-bold">Weekly Test Report</h2>
             <p className="text-gray-600">{selectedTest.classes?.name} | {selectedTest.subjects?.name} | Teacher: {selectedTest.profiles?.name}</p>
             <p className="text-sm mt-1">Date: {selectedTest.test_date} | Max Marks: {selectedTest.max_marks} | Status: <strong>{selectedTest.status}</strong></p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="btn-hero-outline flex items-center gap-2 print:hidden"><Printer size={18}/> Print Assembly Report</button>
            <button onClick={() => setSelectedTest(null)} className="btn-hero-outline print:hidden">Back</button>
            {selectedTest.status === 'Submitted' && (
              <button onClick={approveTest} className="btn-hero-primary flex items-center gap-2 print:hidden"><CheckCircle size={18}/> Approve Report</button>
            )}
          </div>
        </div>

        {/* Assembly Report Format */}
        <div className="printable-report">
          <div className="text-center mb-8 hidden print:block">
            <h1 className="text-2xl font-bold uppercase tracking-wider">Gyanoday Niketan</h1>
            <h2 className="text-xl font-semibold">Weekly Test Assembly Report</h2>
            <p>{selectedTest.classes?.name} - {selectedTest.subjects?.name} ({selectedTest.test_date})</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bento-card p-6 bg-indigo-50 border border-indigo-100">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-indigo-800"><Trophy size={20}/> Top Performers</h3>
              {topPerformers.length > 0 ? (
                <ul className="space-y-2">
                  {topPerformers.map(p => (
                    <li key={p.id} className="font-medium text-indigo-900">
                      {p.rank === 1 && '🏆 First Position - '}
                      {p.rank === 2 && '🥈 Second Position - '}
                      {p.rank === 3 && '🥉 Third Position - '}
                      {p.students?.name} ({p.score}/{selectedTest.max_marks})
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-indigo-600">No top performers found.</p>}
            </div>

            <div className="bento-card p-6 bg-red-50 border border-red-100">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-red-800"><UserX size={20}/> Requires Attention</h3>
              {requiresAttention.length > 0 ? (
                <ul className="space-y-1">
                  {requiresAttention.map(p => (
                    <li key={p.id} className="text-sm text-red-700">
                      • {p.students?.name} ({p.is_absent ? 'Absent' : `Failed: ${p.score}/${selectedTest.max_marks}`})
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-red-600">All students passed.</p>}
            </div>
          </div>

          <h3 className="font-bold text-xl mb-4">Complete Result Sheet</h3>
          <table className="w-full text-left bg-white border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 border-b">Roll No</th>
                <th className="p-3 border-b">Student Name</th>
                <th className="p-3 border-b">Marks</th>
                <th className="p-3 border-b">Percentage</th>
                <th className="p-3 border-b">Rank</th>
                <th className="p-3 border-b">Result</th>
              </tr>
            </thead>
            <tbody>
              {testMarks.map(m => (
                <tr key={m.id} className="border-b">
                  <td className="p-3">{m.students?.roll_no}</td>
                  <td className="p-3 font-medium">{m.students?.name}</td>
                  <td className="p-3">{m.is_absent ? '-' : m.score}</td>
                  <td className="p-3">{m.is_absent ? '-' : `${m.percentage}%`}</td>
                  <td className="p-3 font-bold">{m.rank}</td>
                  <td className="p-3">
                     <span className={`px-2 py-1 text-xs rounded-full ${m.result === 'Pass' ? 'bg-green-100 text-green-800' : m.result === 'Fail' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                       {m.result}
                     </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="mt-16 flex justify-between px-10 hidden print:flex">
             <div className="text-center border-t border-gray-400 pt-2 w-48">Teacher Signature</div>
             <div className="text-center border-t border-gray-400 pt-2 w-48">Principal Signature</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold">Weekly Test Tracker</h2>
         <div className="flex gap-4">
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm text-sm border-l-4 border-yellow-400"><span className="font-bold">{tests.filter(t=>t.status==='Draft').length}</span> Draft</div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm text-sm border-l-4 border-red-500"><span className="font-bold">{tests.filter(t=>t.status==='Submitted').length}</span> Pending Approval</div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm text-sm border-l-4 border-green-500"><span className="font-bold">{tests.filter(t=>t.status==='Approved').length}</span> Approved</div>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
             <tr>
               <th className="p-4 font-semibold text-gray-600">Date</th>
               <th className="p-4 font-semibold text-gray-600">Class</th>
               <th className="p-4 font-semibold text-gray-600">Subject</th>
               <th className="p-4 font-semibold text-gray-600">Teacher</th>
               <th className="p-4 font-semibold text-gray-600">Status</th>
               <th className="p-4 font-semibold text-gray-600">Action</th>
             </tr>
          </thead>
          <tbody>
             {tests.map(test => (
               <tr key={test.id} className="border-b border-gray-100">
                 <td className="p-4">{test.test_date}</td>
                 <td className="p-4 font-medium">{test.classes?.name}</td>
                 <td className="p-4">{test.subjects?.name}</td>
                 <td className="p-4">{test.profiles?.name}</td>
                 <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex w-fit items-center gap-1 ${
                      test.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                      test.status === 'Submitted' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {test.status === 'Draft' && <Clock size={12} />}
                      {test.status === 'Submitted' && <AlertTriangle size={12} />}
                      {test.status === 'Approved' && <CheckCircle size={12} />}
                      {test.status}
                    </span>
                 </td>
                 <td className="p-4">
                    <button onClick={() => viewReport(test)} className="text-indigo-600 font-medium hover:text-indigo-800 text-sm">
                       {test.status === 'Draft' ? 'Preview' : 'View Report'}
                    </button>
                 </td>
               </tr>
             ))}
             {tests.length === 0 && (
               <tr>
                 <td colSpan="6" className="p-8 text-center text-gray-500">No weekly tests recorded yet.</td>
               </tr>
             )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
