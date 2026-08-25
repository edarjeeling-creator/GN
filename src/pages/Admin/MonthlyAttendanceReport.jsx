import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import { Calendar, Users, Loader2, Info } from 'lucide-react';
import { getDaysInMonth, format, isWeekend, isFuture, parseISO } from 'date-fns';

const MonthlyAttendanceReport = () => {
  const { classes, students, academicYear } = useData();
  
  const [role, setRole] = useState('student');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedClassId, setSelectedClassId] = useState('');
  
  const [attendanceData, setAttendanceData] = useState([]);
  const [entities, setEntities] = useState([]); // students or teachers
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Derive days in the selected month
  const daysInMonth = useMemo(() => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split('-');
    const daysCount = getDaysInMonth(new Date(year, parseInt(month) - 1));
    const days = [];
    for (let i = 1; i <= daysCount; i++) {
      const dateString = `${year}-${month}-${String(i).padStart(2, '0')}`;
      days.push({
        dayNumber: i,
        dateString,
        isWeekend: isWeekend(parseISO(dateString)),
        isFuture: isFuture(parseISO(dateString))
      });
    }
    return days;
  }, [selectedMonth]);

  useEffect(() => {
    fetchReportData();
  }, [role, selectedMonth, selectedClassId, academicYear]);

  const fetchReportData = async () => {
    if (!selectedMonth) return;
    if (role === 'student' && !selectedClassId) {
      setEntities([]);
      setAttendanceData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-${getDaysInMonth(new Date(year, parseInt(month) - 1))}`;

      if (role === 'student') {
        // Fetch Students in Class
        const classStudents = students.filter(s => s.class_id === selectedClassId)
                                      .sort((a, b) => a.name.localeCompare(b.name));
        setEntities(classStudents);

        // Fetch Attendance
        const { data, error: attError } = await supabase
          .from('attendance')
          .select('student_id, date, status')
          .eq('class_id', selectedClassId)
          .eq('academic_year', academicYear)
          .gte('date', startDate)
          .lte('date', endDate);

        if (attError) throw attError;
        setAttendanceData(data || []);
      } else if (role === 'teacher') {
        // Fetch Teachers
        const { data: teachers, error: tError } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('role', 'teacher')
          .order('name');
        
        if (tError) throw tError;
        setEntities(teachers || []);

        // Fetch Teacher Attendance
        const { data, error: attError } = await supabase
          .from('teacher_attendance')
          .select('teacher_id, attendance_date, status')
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate);

        if (attError) throw attError;
        
        // Normalize teacher_attendance to have 'date' and 'student_id' fields for uniform rendering
        const normalizedData = (data || []).map(record => ({
          student_id: record.teacher_id, // map teacher_id to student_id for uniform logic
          date: record.attendance_date,
          status: record.status
        }));
        setAttendanceData(normalizedData);
      }
    } catch (err) {
      console.error("Error fetching report data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusAbbreviation = (status) => {
    switch (status) {
      case 'Present': return 'P';
      case 'Absent': return 'A';
      case 'Late': return 'L';
      case 'Half Day': return 'H';
      case 'Leave': return 'V';
      default: return '—';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return 'text-green-600 bg-green-50 border border-green-200';
      case 'Absent': return 'text-red-600 bg-red-50 border border-red-200';
      case 'Late': return 'text-yellow-600 bg-yellow-50 border border-yellow-200';
      case 'Half Day': return 'text-orange-600 bg-orange-50 border border-orange-200';
      case 'Leave': return 'text-purple-600 bg-purple-50 border border-purple-200';
      default: return 'text-gray-400 bg-transparent';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Calendar className="text-primary" size={24} />
          Monthly Attendance Report
        </h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Role</label>
            <select 
              className="input-field w-full"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setSelectedClassId('');
              }}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Month</label>
            <input 
              type="month"
              className="input-field w-full"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

          {role === 'student' && (
            <div>
              <label className="block text-sm font-semibold mb-2">Class</label>
              <select 
                className="input-field w-full"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                <option value="">Select Class</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.section}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Users size={20} className="text-gray-600" />
            {role === 'student' ? 'Student' : 'Teacher'} Attendance ({format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')})
          </h3>

          <div className="flex items-center gap-3 text-sm flex-wrap">
            <div className="flex items-center gap-1"><span className="w-5 h-5 flex items-center justify-center bg-green-50 text-green-600 rounded text-xs font-bold border border-green-200">P</span> Present</div>
            <div className="flex items-center gap-1"><span className="w-5 h-5 flex items-center justify-center bg-red-50 text-red-600 rounded text-xs font-bold border border-red-200">A</span> Absent</div>
            <div className="flex items-center gap-1"><span className="w-5 h-5 flex items-center justify-center bg-yellow-50 text-yellow-600 rounded text-xs font-bold border border-yellow-200">L</span> Late</div>
            <div className="flex items-center gap-1"><span className="w-5 h-5 flex items-center justify-center bg-orange-50 text-orange-600 rounded text-xs font-bold border border-orange-200">H</span> Half Day</div>
            <div className="flex items-center gap-1"><span className="w-5 h-5 flex items-center justify-center bg-purple-50 text-purple-600 rounded text-xs font-bold border border-purple-200">V</span> Leave</div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg mb-4 flex items-center gap-2">
            <Info size={20} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12 text-gray-500">
            <Loader2 className="animate-spin mr-2" size={24} /> Loading report...
          </div>
        ) : (role === 'student' && !selectedClassId) ? (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            Please select a class to view the student report.
          </div>
        ) : entities.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            No {role}s found for the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-700 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-semibold border-b border-gray-200 sticky left-0 bg-gray-50 z-20 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Name
                  </th>
                  {daysInMonth.map(day => (
                    <th 
                      key={day.dateString} 
                      className={`px-2 py-3 font-semibold border-b border-gray-200 text-center min-w-[40px] ${day.isWeekend ? 'bg-gray-100 text-gray-500' : ''}`}
                      title={format(parseISO(day.dateString), 'EEEE, MMM d, yyyy')}
                    >
                      {day.dayNumber}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entities.map(entity => (
                  <tr key={entity.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2 font-medium sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] truncate max-w-[250px]">
                      {entity.name}
                      {role === 'student' && entity.roll_no && <span className="text-xs text-gray-500 ml-2">({entity.roll_no})</span>}
                    </td>
                    {daysInMonth.map(day => {
                      // Find attendance record for this entity on this day
                      const record = attendanceData.find(a => 
                        a.student_id === entity.id && 
                        a.date === day.dateString
                      );
                      
                      const status = record ? record.status : null;
                      const isFutureDate = day.isFuture;
                      
                      let display = '—';
                      let colorClass = 'text-gray-300 bg-transparent';
                      
                      if (!isFutureDate && status) {
                        display = getStatusAbbreviation(status);
                        colorClass = `font-bold ${getStatusColor(status)}`;
                      } else if (day.isWeekend && !status) {
                        display = '-';
                        colorClass = 'text-gray-300 font-medium bg-transparent';
                      }

                      return (
                        <td 
                          key={`${entity.id}-${day.dateString}`} 
                          className={`px-2 py-2 text-center border-l border-gray-100 ${day.isWeekend ? 'bg-gray-50/50' : ''}`}
                        >
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs ${colorClass}`}>
                            {display}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyAttendanceReport;
