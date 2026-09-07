import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, CheckCircle, Clock, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

const TeacherAttendanceHistory = ({ teacherId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (teacherId) {
      fetchHistory();
    }
  }, [teacherId, currentMonth]);

  const fetchHistory = async () => {
    setLoading(true);
    // Get first and last day of current month
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('teacher_attendance')
      .select('*')
      .eq('teacher_id', teacherId)
      .gte('attendance_date', startStr)
      .lte('attendance_date', endStr)
      .order('attendance_date', { ascending: false });

    if (!error && data) {
      setHistory(data);
    }
    setLoading(false);
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Stats
  const presentCount = history.filter(h => h.status.includes('Present')).length;
  const lateCount = history.filter(h => h.status === 'Late').length;
  const leaveCount = history.filter(h => h.status === 'Leave' || h.status === 'Medical Leave').length;
  
  // Exclude future days from total days
  const today = new Date();
  let daysInMonthSoFar = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  if (currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear()) {
    daysInMonthSoFar = today.getDate();
  } else if (currentMonth > today) {
    daysInMonthSoFar = 0;
  }
  
  const presentDays = presentCount + lateCount;
  const attendancePercentage = daysInMonthSoFar > 0 ? Math.round((presentDays / daysInMonthSoFar) * 100) : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl mt-8 mb-8 overflow-hidden">
      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 text-white">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Calendar className="text-brand-400" /> My Attendance History
        </h3>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full transition-colors" title="Previous Month"><ChevronLeft size={20}/></button>
          <span className="font-semibold text-slate-100 min-w-[140px] text-center">{monthName}</span>
          <button 
            onClick={nextMonth} 
            className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent" 
            disabled={currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear()}
            title="Next Month"
          >
            <ChevronRight size={20} className={currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear() ? 'text-slate-600' : 'text-slate-300'}/>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800/80">
        <div className="bg-slate-900/70 p-6 text-center hover:bg-slate-800/50 transition-colors">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle className="text-emerald-400" size={20}/>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Present</span>
          </div>
          <span className="text-3xl font-black text-white">{presentCount}</span>
        </div>
        <div className="bg-slate-900/70 p-6 text-center hover:bg-slate-800/50 transition-colors">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="text-amber-400" size={20}/>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Late</span>
          </div>
          <span className="text-3xl font-black text-white">{lateCount}</span>
        </div>
        <div className="bg-slate-900/70 p-6 text-center hover:bg-slate-800/50 transition-colors">
          <div className="flex items-center justify-center gap-2 mb-2">
            <AlertTriangle className="text-rose-400" size={20}/>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Leave</span>
          </div>
          <span className="text-3xl font-black text-white">{leaveCount}</span>
        </div>
        <div className="bg-slate-900/70 p-6 text-center hover:bg-slate-800/50 transition-colors">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calendar className="text-brand-400" size={20}/>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monthly %</span>
          </div>
          <span className="text-3xl font-black text-white">{attendancePercentage}%</span>
        </div>
      </div>

      {history.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-700/80 text-xs uppercase tracking-wider text-slate-400">
                <th className="p-4 font-semibold">Date</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Check In</th>
                <th className="p-4 font-semibold">Check Out</th>
                <th className="p-4 font-semibold">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {history.map(record => (
                <tr key={record.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 font-semibold text-slate-100 text-sm">
                    {new Date(record.attendance_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                      ${record.status.includes('Present') ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 
                        record.status === 'Late' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 
                        'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="p-4 text-slate-200 text-sm font-medium font-mono">
                    {record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                  </td>
                  <td className="p-4 text-slate-400 text-sm font-medium font-mono">
                    {record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                  </td>
                  <td className="p-4 text-slate-200 text-sm font-mono font-medium">
                    {record.working_hours || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-400 text-sm">
          No attendance records found for {monthName}.
        </div>
      )}
    </div>
  );
};

export default TeacherAttendanceHistory;
