import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, CheckCircle, Clock, AlertTriangle, User, Settings, Save, Edit, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const StaffAttendance = () => {
  const { profile } = useAuth();
  const [staffAttData, setStaffAttData] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [settings, setSettings] = useState({ reporting_time: '08:45', grace_mins: 10 });
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [editingRecord, setEditingRecord] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  
  useEffect(() => {
    fetchData();
  }, [dateFilter]);

  const fetchData = async () => {
    setLoading(true);
    // Fetch teachers
    const { data: tData } = await supabase.from('profiles').select('*').eq('role', 'teacher');
    if (tData) setTeachers(tData);

    // Fetch settings
    const { data: sData } = await supabase.from('school_settings').select('*').in('setting_key', ['staff_reporting_time', 'staff_grace_period_mins']);
    if (sData) {
      let rTime = '08:45';
      let gMins = 10;
      sData.forEach(s => {
        if (s.setting_key === 'staff_reporting_time') rTime = s.setting_value;
        if (s.setting_key === 'staff_grace_period_mins') gMins = parseInt(s.setting_value) || 10;
      });
      setSettings({ reporting_time: rTime, grace_mins: gMins });
    }

    // Fetch attendance for date
    const { data: aData } = await supabase.from('teacher_attendance').select('*').eq('attendance_date', dateFilter);
    if (aData) setStaffAttData(aData);
    setLoading(false);
  };

  const saveSettings = async () => {
    await supabase.from('school_settings').upsert([
      { setting_key: 'staff_reporting_time', setting_value: settings.reporting_time, description: 'Standard reporting time for staff' },
      { setting_key: 'staff_grace_period_mins', setting_value: settings.grace_mins.toString(), description: 'Grace period allowed after reporting time before being marked Late' }
    ], { onConflict: 'setting_key' });
    setShowSettings(false);
    alert('Settings saved!');
  };

  const saveCorrection = async () => {
    if (!correctionReason) {
      alert("Please provide a reason for the correction.");
      return;
    }
    
    let recordId = editingRecord.record?.id;
    const oldStatus = editingRecord.record ? editingRecord.record.status : 'Absent';

    // Insert or Update teacher_attendance
    if (recordId) {
      const { error: updateError } = await supabase.from('teacher_attendance')
        .update({ status: newStatus })
        .eq('id', recordId);
      if (updateError) { alert("Error updating: " + updateError.message); return; }
    } else {
      const { data: newRec, error: insertError } = await supabase.from('teacher_attendance')
        .insert([{
          teacher_id: editingRecord.teacher.id,
          attendance_date: dateFilter,
          status: newStatus
        }])
        .select()
        .single();
      if (insertError) { alert("Error inserting: " + insertError.message); return; }
      recordId = newRec.id;
    }

    // Insert into audit logs
    await supabase.from('attendance_audit_logs').insert([{
      record_id: recordId,
      modified_by: profile.id,
      original_status: oldStatus,
      new_status: newStatus,
      reason: correctionReason
    }]);

    setEditingRecord(null);
    setCorrectionReason('');
    fetchData(); // reload
  };

  // KPIs
  const totalStaff = teachers.length;
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let leaveCount = 0;

  const feed = teachers.map(t => {
    const record = staffAttData.find(a => a.teacher_id === t.id);
    let status = 'Absent';
    if (record) {
      status = record.status;
    }
    
    if (status.includes('Present')) presentCount++;
    else if (status === 'Late') lateCount++;
    else if (status === 'Leave' || status === 'Medical Leave') leaveCount++;
    else absentCount++;

    return { teacher: t, record, status };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Staff Attendance</h2>
        <div className="flex gap-4">
          <input 
            type="date" 
            className="input-field max-w-[200px]" 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
          />
          <button 
            className="btn-secondary flex items-center gap-2"
            onClick={() => setShowSettings(true)}
          >
            <Settings size={18} /> Manage Rules
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card text-center p-4">
          <div className="text-slate-500 font-semibold mb-1">Total Staff</div>
          <div className="text-3xl font-black text-slate-800">{totalStaff}</div>
        </div>
        <div className="card text-center p-4">
          <div className="text-green-500 font-semibold mb-1">Present</div>
          <div className="text-3xl font-black text-slate-800">{presentCount}</div>
        </div>
        <div className="card text-center p-4">
          <div className="text-amber-500 font-semibold mb-1">Late</div>
          <div className="text-3xl font-black text-slate-800">{lateCount}</div>
        </div>
        <div className="card text-center p-4">
          <div className="text-red-500 font-semibold mb-1">Absent</div>
          <div className="text-3xl font-black text-slate-800">{absentCount}</div>
        </div>
        <div className="card text-center p-4">
          <div className="text-purple-500 font-semibold mb-1">On Leave</div>
          <div className="text-3xl font-black text-slate-800">{leaveCount}</div>
        </div>
      </div>

      {showSettings && (
        <div className="card border border-primary bg-primary/5 p-6 relative">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Attendance Rules Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Reporting Time (HH:MM)</label>
              <input type="time" className="input-field" value={settings.reporting_time} onChange={e => setSettings({...settings, reporting_time: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Grace Period (Minutes)</label>
              <input type="number" min="0" className="input-field" value={settings.grace_mins} onChange={e => setSettings({...settings, grace_mins: parseInt(e.target.value) || 0})} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={saveSettings}><Save size={16} className="inline mr-2" /> Save Rules</button>
            <button className="btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Late Arrivals Callout */}
      {lateCount > 0 && dateFilter === new Date().toISOString().split('T')[0] && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
          <h3 className="text-amber-800 font-bold flex items-center gap-2 mb-2"><AlertTriangle size={20} /> Late Arrival Monitoring</h3>
          <div className="flex flex-wrap gap-2">
            {feed.filter(f => f.status === 'Late').map(f => (
              <div key={f.teacher.id} className="bg-white border border-amber-200 px-3 py-1 rounded-full text-sm font-medium text-amber-700 shadow-sm">
                {f.teacher.name} – {f.record?.check_in_time ? new Date(f.record.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-semibold text-slate-600">Teacher</th>
              <th className="p-4 font-semibold text-slate-600">Status</th>
              <th className="p-4 font-semibold text-slate-600">Check In</th>
              <th className="p-4 font-semibold text-slate-600">Check Out</th>
              <th className="p-4 font-semibold text-slate-600">Hours</th>
              <th className="p-4 font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {feed.map(f => (
              <tr key={f.teacher.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-4 font-medium text-slate-800">{f.teacher.name}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold uppercase
                    ${f.status.includes('Present') ? 'bg-green-100 text-green-800' : 
                      f.status === 'Late' ? 'bg-amber-100 text-amber-800' : 
                      f.status === 'Absent' ? 'bg-red-100 text-red-800' : 
                      'bg-purple-100 text-purple-800'}`}>
                    {f.status}
                  </span>
                </td>
                <td className="p-4 text-slate-600">{f.record?.check_in_time ? new Date(f.record.check_in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                <td className="p-4 text-slate-600">{f.record?.check_out_time ? new Date(f.record.check_out_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                <td className="p-4 text-slate-600 font-mono">{f.record?.working_hours || '-'}</td>
                <td className="p-4">
                  <button onClick={() => { setEditingRecord(f); setNewStatus(f.status); setCorrectionReason(''); }} className="text-blue-500 hover:bg-blue-50 p-2 rounded-full transition-colors">
                    <Edit size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Correct Attendance</h3>
              <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">Teacher</p>
                <p className="font-bold">{editingRecord.teacher.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Current Status</p>
                  <p className="font-bold">{editingRecord.status}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">New Status</p>
                  <select className="input-field py-2" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                    <option value="Present">Present</option>
                    <option value="Present (Grace)">Present (Grace)</option>
                    <option value="Late">Late</option>
                    <option value="Absent">Absent</option>
                    <option value="Leave">Leave</option>
                    <option value="Medical Leave">Medical Leave</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Official Duty">Official Duty</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Reason for Correction *</label>
                <textarea 
                  className="input-field w-full" 
                  rows="3" 
                  placeholder="e.g. Approved leave request, missed punch..."
                  value={correctionReason}
                  onChange={e => setCorrectionReason(e.target.value)}
                ></textarea>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setEditingRecord(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveCorrection}>Save Correction</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffAttendance;
