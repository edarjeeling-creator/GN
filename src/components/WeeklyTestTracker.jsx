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
        classes(name, section),
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
             <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Surprise Test Report</h2>
             <p className="text-slate-600 dark:text-slate-400 mt-1">{selectedTest.classes?.name} {selectedTest.classes?.section || ''} | {selectedTest.subjects?.name} | Teacher: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTest.profiles?.name}</span></p>
             <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Date: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTest.test_date}</span> | Max Marks: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTest.max_marks}</span> | Status: <strong className="text-brand-600 dark:text-brand-400">{selectedTest.status}</strong></p>
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
            <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-900">Gyanoday Niketan</h1>
            <h2 className="text-xl font-semibold text-slate-800">Surprise Test Assembly Report</h2>
            <p className="text-slate-600">{selectedTest.classes?.name} {selectedTest.classes?.section || ''} - {selectedTest.subjects?.name} ({selectedTest.test_date})</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bento-card p-6 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-indigo-800 dark:text-indigo-300"><Trophy size={20}/> Top Performers</h3>
              {topPerformers.length > 0 ? (
                <ul className="space-y-2">
                  {topPerformers.map(p => (
                    <li key={p.id} className="font-medium text-indigo-950 dark:text-indigo-100">
                      {p.rank === 1 && '🏆 First Position - '}
                      {p.rank === 2 && '🥈 Second Position - '}
                      {p.rank === 3 && '🥉 Third Position - '}
                      <span className="font-semibold">{p.students?.name}</span> ({p.score}/{selectedTest.max_marks})
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-indigo-600 dark:text-indigo-400">No top performers found.</p>}
            </div>

            <div className="bento-card p-6 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-800/50">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-red-800 dark:text-red-300"><UserX size={20}/> Requires Attention</h3>
              {requiresAttention.length > 0 ? (
                <ul className="space-y-1">
                  {requiresAttention.map(p => (
                    <li key={p.id} className="text-sm font-medium text-red-800 dark:text-red-200">
                      • <span className="font-semibold">{p.students?.name}</span> ({p.is_absent ? 'Absent' : `Failed: ${p.score}/${selectedTest.max_marks}`})
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-red-600 dark:text-red-400">All students passed.</p>}
            </div>
          </div>

          <h3 className="font-bold text-xl mb-4 text-slate-900 dark:text-white">Complete Result Sheet</h3>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Roll No</th>
                  <th className="p-3 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Student Name</th>
                  <th className="p-3 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Marks</th>
                  <th className="p-3 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Percentage</th>
                  <th className="p-3 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Rank</th>
                  <th className="p-3 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {testMarks.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{m.students?.roll_no}</td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{m.students?.name}</td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{m.is_absent ? '-' : m.score}</td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{m.is_absent ? '-' : `${m.percentage}%`}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{m.rank}</td>
                    <td className="p-3">
                       <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                         m.result === 'Pass' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50' : 
                         m.result === 'Fail' ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800/50' : 
                         'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                       }`}>
                         {m.result}
                       </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-16 flex justify-between px-10 hidden print:flex">
             <div className="text-center border-t border-gray-400 pt-2 w-48 font-medium">Teacher Signature</div>
             <div className="text-center border-t border-gray-400 pt-2 w-48 font-medium">Principal Signature</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Surprise Test Tracker</h2>
         <div className="flex gap-4">
            <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-lg shadow-sm text-sm border-l-4 border-yellow-400 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"><span className="font-bold">{tests.filter(t=>t.status==='Draft').length}</span> Draft</div>
            <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-lg shadow-sm text-sm border-l-4 border-red-500 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"><span className="font-bold">{tests.filter(t=>t.status==='Submitted').length}</span> Pending Approval</div>
            <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-lg shadow-sm text-sm border-l-4 border-green-500 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"><span className="font-bold">{tests.filter(t=>t.status==='Approved').length}</span> Approved</div>
         </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
             <tr>
               <th className="p-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Date</th>
               <th className="p-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Class</th>
               <th className="p-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Subject</th>
               <th className="p-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Teacher</th>
               <th className="p-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Status</th>
               <th className="p-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">Action</th>
             </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
             {tests.map(test => (
               <tr key={test.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                 <td className="p-4 font-medium text-slate-700 dark:text-slate-300">{test.test_date}</td>
                 <td className="p-4 font-bold text-slate-900 dark:text-white">{test.classes?.name} {test.classes?.section || ''}</td>
                 <td className="p-4 font-medium text-slate-800 dark:text-slate-200">{test.subjects?.name}</td>
                 <td className="p-4 text-slate-700 dark:text-slate-300">{test.profiles?.name}</td>
                 <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold flex w-fit items-center gap-1 border ${
                      test.status === 'Draft' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/50' :
                      test.status === 'Submitted' ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800/50' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                    }`}>
                      {test.status === 'Draft' && <Clock size={12} />}
                      {test.status === 'Submitted' && <AlertTriangle size={12} />}
                      {test.status === 'Approved' && <CheckCircle size={12} />}
                      {test.status}
                    </span>
                 </td>
                 <td className="p-4">
                    <button onClick={() => viewReport(test)} className="text-brand-600 dark:text-brand-400 font-semibold hover:underline text-sm">
                       {test.status === 'Draft' ? 'Preview' : 'View Report'}
                    </button>
                 </td>
               </tr>
             ))}
             {tests.length === 0 && (
               <tr>
                 <td colSpan="6" className="p-8 text-center text-slate-500 dark:text-slate-400">No surprise tests recorded yet.</td>
               </tr>
             )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
