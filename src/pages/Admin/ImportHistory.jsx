import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Clock, RotateCcw, AlertCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const ImportHistory = ({ academicYear }) => {
  const { classes, students } = useData();
  const { profile } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('import_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleRollback = async (record) => {
    const cls = classes.find(c => c.id === record.class_id);
    const className = cls ? `${cls.name} ${cls.section}` : 'Unknown Class';
    
    const confirmed = window.confirm(`Are you sure you want to rollback this import?\n\nFile: ${record.file_name}\nClass: ${className}\nTerm: ${record.term}\n\nThis will delete ALL marks for this class and term!`);
    if (!confirmed) return;
    
    try {
      // Soft-delete the marks associated with this import session
      const { error: deleteError } = await supabase
        .from('marks')
        .update({ deleted_at: new Date().toISOString(), deleted_by: profile?.id })
        .eq('import_id', record.id)
        .is('deleted_at', null);
        
      if (deleteError) throw deleteError;
      
      // Update history status
      await supabase
        .from('import_history')
        .update({ status: 'Rolled Back' })
        .eq('id', record.id);
        
      alert('Rollback successful. Marks have been cleared.');
      fetchHistory();
    } catch (err) {
      console.error(err);
      alert('Error during rollback: ' + err.message);
    }
  };

  if (loading) return <div>Loading history...</div>;

  return (
    <div className="bento-card" style={{ padding: '2rem', marginTop: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Clock size={24} color="var(--primary-color)" />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Excel Import History</h3>
        </div>
        <button 
          onClick={() => {
            const ws = XLSX.utils.json_to_sheet(history);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "ImportHistory");
            XLSX.writeFile(wb, `Import_History_${academicYear}.xlsx`);
          }}
          className="btn"
          style={{ background: '#fff', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Download size={16} /> Export to Excel
        </button>
      </div>
      
      <div style={{ overflowX: 'auto', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
        <table className="data-table" style={{ width: '100%', minWidth: '600px' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Date</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>File</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>User</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Records</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Status</th>
              <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No imports recorded yet.</td>
              </tr>
            ) : (
              history.map(record => {
                const date = new Date(record.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const isRolledBack = record.status === 'Rolled Back';
                
                return (
                  <tr key={record.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: isRolledBack ? 0.6 : 1 }}>
                    <td style={{ padding: '1rem' }}>{date}</td>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{record.file_name}</td>
                    <td style={{ padding: '1rem' }}>{record.user_name || 'Admin'}</td>
                    <td style={{ padding: '1rem' }}>{record.record_count}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '4px', 
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: isRolledBack ? '#fee2e2' : '#dcfce7',
                        color: isRolledBack ? '#ef4444' : '#16a34a'
                      }}>
                        {record.status}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {!isRolledBack && (
                        <button 
                          onClick={() => handleRollback(record)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.8rem', background: '#fff', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                        >
                          <RotateCcw size={14} /> Rollback
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ImportHistory;
