import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, Users, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

const FeeOverview = () => {
  const [stats, setStats] = useState({
    totalBilled: 0,
    totalCollected: 0,
    outstanding: 0,
    pendingVerifications: 0,
    defaultersCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverviewStats();
  }, []);

  const fetchOverviewStats = async () => {
    setLoading(true);
    try {
      // 1. Get all demands (Total Billed)
      const { data: demands } = await supabase.from('fee_demands').select('total_amount, status');
      
      // 2. Get all payments (Total Collected & Pending Verification)
      const { data: payments } = await supabase.from('fee_payments').select('amount, status');

      let billed = 0;
      let collected = 0;
      let pendingVerifications = 0;
      let defaulters = 0; // Simple count of demands with 'pending' status

      if (demands) {
        demands.forEach(d => {
          if (d.status !== 'cancelled') {
            billed += Number(d.total_amount);
            if (d.status === 'pending') defaulters++;
          }
        });
      }

      if (payments) {
        payments.forEach(p => {
          if (p.status === 'approved') collected += Number(p.amount);
          if (p.status === 'pending_verification') pendingVerifications++;
        });
      }

      setStats({
        totalBilled: billed,
        totalCollected: collected,
        outstanding: billed - collected,
        pendingVerifications,
        defaultersCount: defaulters
      });

    } catch (err) {
      console.error("Error fetching fee stats:", err);
    }
    setLoading(false);
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Calculating school financials...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Financial Overview</h2>
          <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Real-time summary of fee collections and outstanding dues.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        
        {/* Total Collected */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '1rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#166534' }}>
            <div style={{ background: '#dcfce7', padding: '0.5rem', borderRadius: '0.5rem' }}><CheckCircle2 size={24} /></div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Total Collected</h3>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, color: '#15803d' }}>₹{stats.totalCollected.toLocaleString('en-IN')}</p>
        </div>

        {/* Outstanding Balance */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '1rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#b45309' }}>
            <div style={{ background: '#fef3c7', padding: '0.5rem', borderRadius: '0.5rem' }}><AlertCircle size={24} /></div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Total Outstanding</h3>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, color: '#b45309' }}>₹{stats.outstanding.toLocaleString('en-IN')}</p>
        </div>

        {/* Total Billed */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '1rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#1e40af' }}>
            <div style={{ background: '#dbeafe', padding: '0.5rem', borderRadius: '0.5rem' }}><TrendingUp size={24} /></div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Total Billed</h3>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1d4ed8' }}>₹{stats.totalBilled.toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.5rem', background: '#f8fafc' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Clock size={18} color="#f59e0b" /> Attention Required
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
            <span style={{ fontWeight: 500, color: '#475569' }}>Pending Manual Verifications</span>
            <span style={{ background: stats.pendingVerifications > 0 ? '#fee2e2' : '#f1f5f9', color: stats.pendingVerifications > 0 ? '#b91c1c' : '#64748b', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontWeight: 700 }}>
              {stats.pendingVerifications} Actionable
            </span>
          </div>
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.5rem', background: '#f8fafc' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Users size={18} color="#ef4444" /> Defaulter Status
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
            <span style={{ fontWeight: 500, color: '#475569' }}>Unpaid Invoices</span>
            <span style={{ color: '#dc2626', fontWeight: 700 }}>
              {stats.defaultersCount} invoices pending
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default FeeOverview;
