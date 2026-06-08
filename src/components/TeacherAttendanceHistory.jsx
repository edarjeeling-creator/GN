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
    <div className="card shadow-sm border border-slate-200 mt-8 mb-8 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="text-primary" /> My Attendance History
        </h3>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft size={20}/></button>
          <span className="font-semibold text-slate-700 min-w-[120px] text-center">{monthName}</span>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors" disabled={currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear()}>
            <ChevronRight size={20} className={currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear() ? 'text-slate-300' : ''}/>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200">
        <div className="bg-white p-6 text-center hover:bg-slate-50 transition-colors">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle className="text-green-500" size={20}/>
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Present</span>
          </div>
          <span className="text-3xl font-black text-slate-800">{presentCount}</span>
        </div>
        <div className="bg-white p-6 text-center hover:bg-slate-50 transition-colors">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="text-amber-500" size={20}/>
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Late</span>
          </div>
          <span className="text-3xl font-black text-slate-800">{lateCount}</span>
        </div>
        <div className="bg-white p-6 text-center hover:bg-slate-50 transition-colors">
          <div className="flex items-center justify-center gap-2 mb-2">
            <AlertTriangle className="text-red-500" size={20}/>
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Leave</span>
          </div>
          <span className="text-3xl font-black text-slate-800">{leaveCount}</span>
        </div>
        <div className="bg-white p-6 text-center hover:bg-slate-50 transition-colors">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calendar className="text-primary" size={20}/>
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Monthly %</span>
          </div>
          <span className="text-3xl font-black text-slate-800">{attendancePercentage}%</span>
        </div>
      </div>

      {history.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm uppercase text-slate-500">
                <th className="p-4 font-semibold">Date</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Check In</th>
                <th className="p-4 font-semibold">Check Out</th>
                <th className="p-4 font-semibold">Hours</th>
              </tr>
            </thead>
            <tbody>
              {history.map(record => (
                <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-700">
                    {new Date(record.attendance_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                      ${record.status.includes('Present') ? 'bg-green-100 text-green-800' : 
                        record.status === 'Late' ? 'bg-amber-100 text-amber-800' : 
                        'bg-red-100 text-red-800'}`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 text-sm">
                    {record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                  </td>
                  <td className="p-4 text-slate-600 text-sm">
                    {record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                  </td>
                  <td className="p-4 text-slate-600 text-sm font-mono">
                    {record.working_hours || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500">
          No attendance records found for {monthName}.
        </div>
      )}
    </div>
  );
};

export default TeacherAttendanceHistory;
