import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('marks_audit_log')
      .select(`
        *,
        students:student_id (name, roll_no),
        subjects:subject_id (name)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error(error);
    } else if (data) {
      setLogs(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield size={20} className="text-primary" />
          Marks Audit Log
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const exportData = logs.map(log => ({
                Timestamp: format(new Date(log.created_at), 'MMM d, yyyy HH:mm'),
                StudentName: log.students?.name,
                RollNo: log.students?.roll_no,
                Subject: log.subjects?.name,
                Term: log.term,
                OldScore: log.old_score !== null ? log.old_score : 'N/A',
                NewScore: log.new_score !== null ? log.new_score : 'N/A',
                ChangedBy: log.changer_name || 'Unknown'
              }));
              const ws = XLSX.utils.json_to_sheet(exportData);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "AuditLogs");
              XLSX.writeFile(wb, `Marks_Audit_Logs_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
            }}
          >
            Export to Excel
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-slate-500">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-slate-500">No score changes have been logged yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Student</th>
                  <th>Subject</th>
                  <th>Term</th>
                  <th>Change</th>
                  <th>Changed By</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-sm text-slate-500">
                      {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td>
                      <div className="font-medium text-slate-800">{log.students?.name}</div>
                      <div className="text-xs text-slate-500">Roll: {log.students?.roll_no}</div>
                    </td>
                    <td className="text-slate-700">{log.subjects?.name}</td>
                    <td>
                      <Badge variant="outline">{log.term}</Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="line-through text-red-500">{log.old_score !== null ? log.old_score : 'N/A'}</span>
                        <span>→</span>
                        <span className="font-bold text-emerald-600">{log.new_score !== null ? log.new_score : 'N/A'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="text-sm font-medium text-slate-800">{log.changer_name || 'Unknown'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditLog;
