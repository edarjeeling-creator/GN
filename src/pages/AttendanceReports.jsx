import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Users, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';

const AttendanceReports = () => {
  const { classes, students, attendance, academicYear } = useData();
  const [selectedClassId, setSelectedClassId] = useState('');

  // 1. Calculate school-wide or class-wide stats
  const filteredAttendance = useMemo(() => {
    let filtered = attendance.filter(a => a.academic_year === academicYear);
    if (selectedClassId) {
      filtered = filtered.filter(a => a.class_id === selectedClassId);
    }
    return filtered;
  }, [attendance, academicYear, selectedClassId]);

  const stats = useMemo(() => {
    const total = filteredAttendance.length;
    const present = filteredAttendance.filter(a => a.status === 'Present').length;
    const absent = filteredAttendance.filter(a => a.status === 'Absent').length;
    const late = filteredAttendance.filter(a => a.status === 'Late').length;
    const leave = filteredAttendance.filter(a => a.status === 'Leave').length;
    const halfDay = filteredAttendance.filter(a => a.status === 'Half Day').length;

    const effectivePresent = present + late + (halfDay * 0.5);
    const percentage = total > 0 ? ((effectivePresent / total) * 100).toFixed(1) : 0;

    return { total, present, absent, late, leave, halfDay, percentage };
  }, [filteredAttendance]);

  const pieData = [
    { name: 'Present', value: stats.present, color: '#22c55e' },
    { name: 'Absent', value: stats.absent, color: '#ef4444' },
    { name: 'Late', value: stats.late, color: '#eab308' },
    { name: 'Leave', value: stats.leave, color: '#f97316' },
  ].filter(d => d.value > 0);

  // Find chronic absentees (attendance < 75%)
  const chronicAbsentees = useMemo(() => {
    if (!selectedClassId) return [];
    
    const classStudents = students.filter(s => s.class_id === selectedClassId);
    return classStudents.map(student => {
      const stuAtt = filteredAttendance.filter(a => a.student_id === student.id);
      const sTotal = stuAtt.length;
      if (sTotal === 0) return null;
      
      const sPresent = stuAtt.filter(a => a.status === 'Present' || a.status === 'Late').length;
      const sHalf = stuAtt.filter(a => a.status === 'Half Day').length;
      const effPres = sPresent + (sHalf * 0.5);
      const perc = ((effPres / sTotal) * 100);
      
      return { ...student, attendancePercentage: perc, totalDays: sTotal };
    }).filter(s => s && s.attendancePercentage < 75)
      .sort((a,b) => a.attendancePercentage - b.attendancePercentage);
  }, [students, filteredAttendance, selectedClassId]);

  return (
    <div>
      <div className="page-header mb-6">
        <div>
          <h1>Attendance Analytics</h1>
          <p>Monitor school-wide and class-wise attendance trends.</p>
        </div>
      </div>

      <div className="card mb-6 p-4">
        <label className="block mb-2 font-bold">Filter by Class</label>
        <select 
          className="input-field w-full md:w-1/3"
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
        >
          <option value="">All Classes (School Wide)</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name} {c.section}</option>
          ))}
        </select>
      </div>

      {stats.total === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          No attendance records found for the selected filter.
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-6 mb-6">
            <div className="card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
              <div className="flex items-center gap-3 mb-2">
                <Users className="text-primary" />
                <h3 className="m-0" style={{ fontSize: '1.1rem' }}>Total Records</h3>
              </div>
              <p className="text-3xl font-bold m-0" style={{ color: 'var(--text-primary)' }}>{stats.total}</p>
            </div>
            
            <div className="card" style={{ borderLeft: '4px solid var(--success-color)' }}>
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle style={{ color: 'var(--success-color)' }} />
                <h3 className="m-0" style={{ fontSize: '1.1rem' }}>Overall Attendance</h3>
              </div>
              <p className="text-3xl font-bold m-0" style={{ color: 'var(--text-primary)' }}>{stats.percentage}%</p>
            </div>

            <div className="card" style={{ borderLeft: '4px solid var(--danger-color)' }}>
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle style={{ color: 'var(--danger-color)' }} />
                <h3 className="m-0" style={{ fontSize: '1.1rem' }}>Total Absences</h3>
              </div>
              <p className="text-3xl font-bold m-0" style={{ color: 'var(--text-primary)' }}>{stats.absent}</p>
            </div>

            <div className="card" style={{ borderLeft: '4px solid var(--warning-color)' }}>
              <div className="flex items-center gap-3 mb-2">
                <TrendingDown style={{ color: 'var(--warning-color)' }} />
                <h3 className="m-0" style={{ fontSize: '1.1rem' }}>Total Late/Leave</h3>
              </div>
              <p className="text-3xl font-bold m-0" style={{ color: 'var(--text-primary)' }}>{stats.late + stats.leave}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="mb-4">Attendance Breakdown</h3>
              <div className="flex flex-col gap-4">
                {pieData.map((data) => (
                  <div key={data.name}>
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{data.name}</span>
                      <span>{data.value} records ({((data.value / stats.total) * 100).toFixed(1)}%)</span>
                    </div>
                    <div style={{ width: '100%', backgroundColor: 'var(--border-color)', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ width: `${(data.value / stats.total) * 100}%`, backgroundColor: data.color, height: '100%' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedClassId && (
              <div className="card overflow-hidden flex flex-col">
                <h3 className="mb-4 text-danger-color flex items-center gap-2">
                  <AlertTriangle size={20} /> Chronic Absentees (&lt; 75%)
                </h3>
                {chronicAbsentees.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-success-color font-bold p-8 text-center bg-gray-50 rounded-lg">
                    <CheckCircle className="mr-2" /> All students have good attendance!
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    <table className="data-table w-full">
                      <thead>
                        <tr>
                          <th>Roll No</th>
                          <th>Student Name</th>
                          <th>Attendance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chronicAbsentees.map(s => (
                          <tr key={s.id}>
                            <td>{s.roll_no}</td>
                            <td className="font-medium">{s.name}</td>
                            <td style={{ color: 'var(--danger-color)', fontWeight: 'bold' }}>
                              {s.attendancePercentage.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AttendanceReports;
