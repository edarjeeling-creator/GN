import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, User, CreditCard, Clock, FileText, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

const FeeLedgers = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(false);

  // Ledger state
  const [ledgerData, setLedgerData] = useState({ demands: [], payments: [], balance: 0 });
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Search students (debounced in real app, simple for now)
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('id, name, roll_no, uid, class_id, classes(name, section)')
      .or(`name.ilike.%${searchQuery}%,uid.ilike.%${searchQuery}%`)
      .limit(10);
      
    if (error) console.error("Search error:", error);
    if (data) setStudents(data);
    setLoading(false);
  };

  const loadStudentLedger = async (student) => {
    setSelectedStudent(student);
    setLedgerLoading(true);
    
    try {
      const [demandsRes, paymentsRes] = await Promise.all([
        supabase.from('fee_demands').select('*, fee_demand_items(*, fee_heads(*))').eq('student_id', student.id).order('created_at', { ascending: false }),
        supabase.from('fee_payments').select('*, fee_allocations(*, fee_demands(month, academic_year))').eq('student_id', student.id).order('created_at', { ascending: false })
      ]);

      let totalBilled = 0;
      let totalPaid = 0;

      const demands = demandsRes.data || [];
      const payments = paymentsRes.data || [];

      demands.forEach(d => {
        if (d.status !== 'cancelled') totalBilled += Number(d.total_amount);
      });

      payments.forEach(p => {
        if (p.status === 'approved') totalPaid += Number(p.amount);
      });

      setLedgerData({
        demands,
        payments,
        balance: totalBilled - totalPaid,
        totalBilled,
        totalPaid
      });
    } catch (err) {
      console.error("Error loading ledger:", err);
    }
    setLedgerLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Student Fee Ledgers</h2>
          <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Search for a student to view their complete financial history and current balance.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Left Column: Search & Results */}
        <div style={{ width: '350px', flexShrink: 0 }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input 
              type="text" 
              placeholder="Search name or UID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
            />
            <button type="submit" style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0 1rem', cursor: 'pointer' }}>
              <Search size={20} />
            </button>
          </form>

          {loading ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Searching...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {students.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => loadStudentLedger(s)}
                  style={{
                    padding: '1rem',
                    border: '1px solid',
                    borderColor: selectedStudent?.id === s.id ? '#3b82f6' : '#e2e8f0',
                    background: selectedStudent?.id === s.id ? '#eff6ff' : 'white',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#0f172a', display: 'flex', justifyContent: 'space-between' }}>
                    {s.name}
                    <ArrowRight size={16} color={selectedStudent?.id === s.id ? '#3b82f6' : '#94a3b8'} />
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                    UID: {s.uid || 'N/A'} • {s.classes?.name} {s.classes?.section}
                  </div>
                </div>
              ))}
              {students.length === 0 && searchQuery && !loading && (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No students found.</div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Ledger View */}
        <div style={{ flex: 1 }}>
          {!selectedStudent ? (
            <div style={{ border: '2px dashed #cbd5e1', borderRadius: '1rem', padding: '3rem', textAlign: 'center', color: '#94a3b8', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <User size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>Select a student to view their ledger.</p>
            </div>
          ) : ledgerLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>Loading financial records...</div>
          ) : (
            <div>
              {/* Ledger Header */}
              <div style={{ background: '#1e293b', color: 'white', padding: '1.5rem', borderRadius: '1rem 1rem 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{selectedStudent.name}</h3>
                  <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>UID: {selectedStudent.uid} • {selectedStudent.classes?.name} {selectedStudent.classes?.section}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outstanding Balance</p>
                  <p style={{ fontSize: '2rem', fontWeight: 800, color: ledgerData.balance > 0 ? '#fbbf24' : '#4ade80' }}>
                    ₹{ledgerData.balance.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Ledger Body */}
              <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 1rem 1rem', background: 'white' }}>
                
                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ padding: '1.25rem', borderRight: '1px solid #e2e8f0' }}>
                    <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>Total Billed</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155' }}>₹{ledgerData.totalBilled?.toLocaleString('en-IN')}</p>
                  </div>
                  <div style={{ padding: '1.25rem' }}>
                    <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>Total Paid</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>₹{ledgerData.totalPaid?.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {/* History Tabs (Simple toggle for now) */}
                <div style={{ padding: '1.5rem' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={18} /> Invoices & Demands
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {ledgerData.demands.map(demand => (
                      <div key={demand.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#f8fafc' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 600 }}>{demand.month} {demand.academic_year}</span>
                            {demand.status === 'paid' && <span style={{ background: '#dcfce7', color: '#166534', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>Paid</span>}
                            {demand.status === 'pending' && <span style={{ background: '#fef9c3', color: '#854d0e', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>Pending</span>}
                            {demand.status === 'partial' && <span style={{ background: '#dbeafe', color: '#1e40af', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>Partial</span>}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            Due: {new Date(demand.due_date).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                          ₹{Number(demand.total_amount).toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))}
                    {ledgerData.demands.length === 0 && <p style={{ color: '#64748b', fontStyle: 'italic' }}>No invoices generated for this student.</p>}
                  </div>

                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginTop: '2.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CreditCard size={18} /> Payment History
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {ledgerData.payments.map(payment => (
                      <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#f8fafc' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{payment.payment_mode.replace('_', ' ')}</span>
                            {payment.status === 'approved' && <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 600 }}><CheckCircle size={14}/> Verified</span>}
                            {payment.status === 'pending_verification' && <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 600 }}><Clock size={14}/> Pending</span>}
                            {payment.status === 'rejected' && <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 600 }}><AlertCircle size={14}/> Rejected</span>}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            {new Date(payment.payment_date).toLocaleDateString()} • Ref: {payment.reference_number || 'N/A'}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#059669' }}>
                          +₹{Number(payment.amount).toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))}
                    {ledgerData.payments.length === 0 && <p style={{ color: '#64748b', fontStyle: 'italic' }}>No payment records found.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeeLedgers;
