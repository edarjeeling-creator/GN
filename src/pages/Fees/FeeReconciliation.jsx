import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle, Search, Clock, CheckCircle2, FileDown } from 'lucide-react';

const FeeReconciliation = () => {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'approved', 'rejected'
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments(activeTab);
  }, [activeTab]);

  const fetchPayments = async (statusTab) => {
    setLoading(true);
    let statusFilter = 'pending_verification';
    if (statusTab === 'approved') statusFilter = 'approved';
    if (statusTab === 'rejected') statusFilter = 'rejected';

    const { data, error } = await supabase
      .from('fee_payments')
      .select('*, students(name, roll_no, uid, classes(name, section))')
      .eq('status', statusFilter)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching payments", error);
    } else {
      setPayments(data || []);
    }
    setLoading(false);
  };

  const handleAction = async (paymentId, action, currentStatus) => {
    let remarks = '';
    if (action === 'rejected') {
      remarks = window.prompt("Reason for rejection:");
      if (remarks === null) return; // User cancelled
    } else if (action === 'approved') {
      if (!window.confirm("Approve this payment? It will instantly reflect on the student's ledger.")) return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const { error } = await supabase
      .from('fee_payments')
      .update({
        status: action,
        remarks: remarks || null,
        approved_by: userId,
        approved_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (error) {
      alert("Failed to update payment: " + error.message);
    } else {
      // Remove from current view
      setPayments(payments.filter(p => p.id !== paymentId));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Bank & Manual Reconciliation</h2>
          <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Verify offline payments (bank deposits, UPI, cash) and match bank statements.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: '#334155', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
            <FileDown size={16} /> Import Bank Statement
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '0.75rem 0', background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'pending' ? '2px solid #f59e0b' : '2px solid transparent',
            color: activeTab === 'pending' ? '#d97706' : '#64748b',
            fontWeight: activeTab === 'pending' ? '700' : '500',
            display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '1.5rem'
          }}
        >
          <Clock size={16} /> Pending Verification
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          style={{
            padding: '0.75rem 0', background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'approved' ? '2px solid #10b981' : '2px solid transparent',
            color: activeTab === 'approved' ? '#059669' : '#64748b',
            fontWeight: activeTab === 'approved' ? '700' : '500',
            display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '1.5rem'
          }}
        >
          <CheckCircle2 size={16} /> Verified & Approved
        </button>
        <button
          onClick={() => setActiveTab('rejected')}
          style={{
            padding: '0.75rem 0', background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'rejected' ? '2px solid #ef4444' : '2px solid transparent',
            color: activeTab === 'rejected' ? '#dc2626' : '#64748b',
            fontWeight: activeTab === 'rejected' ? '700' : '500',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          <XCircle size={16} /> Rejected
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
              <th style={{ padding: '1rem', color: '#475569', fontWeight: 600 }}>Date</th>
              <th style={{ padding: '1rem', color: '#475569', fontWeight: 600 }}>Student</th>
              <th style={{ padding: '1rem', color: '#475569', fontWeight: 600 }}>Amount</th>
              <th style={{ padding: '1rem', color: '#475569', fontWeight: 600 }}>Mode & Reference</th>
              <th style={{ padding: '1rem', color: '#475569', fontWeight: 600 }}>Proof</th>
              <th style={{ padding: '1rem', color: '#475569', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading records...</td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No {activeTab.replace('_', ' ')} payments found.
                </td>
              </tr>
            ) : (
              payments.map(payment => (
                <tr key={payment.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '1rem' }}>{new Date(payment.payment_date).toLocaleDateString()}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{payment.students?.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>UID: {payment.students?.uid} • {payment.students?.classes?.name} {payment.students?.classes?.section}</div>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 700, color: '#059669' }}>
                    ₹{Number(payment.amount).toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ textTransform: 'capitalize', fontWeight: 500 }}>{payment.payment_mode.replace('_', ' ')}</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontFamily: 'monospace' }}>Ref: {payment.reference_number || 'N/A'}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {payment.proof_url ? (
                      <a href={payment.proof_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        View Receipt
                      </a>
                    ) : <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No proof attached</span>}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    {payment.status === 'pending_verification' && (
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => handleAction(payment.id, 'approved', payment.status)} style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Approve">
                          <CheckCircle size={18} />
                        </button>
                        <button onClick={() => handleAction(payment.id, 'rejected', payment.status)} style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Reject">
                          <XCircle size={18} />
                        </button>
                      </div>
                    )}
                    {payment.status === 'rejected' && (
                      <div style={{ fontSize: '0.85rem', color: '#dc2626' }}>Rejected: {payment.remarks || 'No reason provided'}</div>
                    )}
                    {payment.status === 'approved' && (
                      <div style={{ fontSize: '0.85rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <CheckCircle size={14} /> Approved
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeeReconciliation;
