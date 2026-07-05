import React, { useState } from 'react';
import { Settings, BarChart, Users, FileText, CheckCircle, Zap } from 'lucide-react';
import FeeConfigurator from './Fees/FeeConfigurator';
import FeeGenerationEngine from './Fees/FeeGenerationEngine';

const FeesDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart size={18} /> },
    { id: 'engine', label: 'Batch Generation', icon: <Zap size={18} /> },
    { id: 'ledgers', label: 'Student Ledgers', icon: <Users size={18} /> },
    { id: 'reconciliation', label: 'Bank & Approval', icon: <CheckCircle size={18} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={18} /> },
    { id: 'configurator', label: 'Configuration', icon: <Settings size={18} /> },
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.025em', marginBottom: '0.5rem' }}>Fee Management</h1>
        <p style={{ color: '#64748b', fontSize: '1.05rem' }}>Comprehensive reconciliation, collection, and configuration center.</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              background: activeTab === tab.id ? '#eff6ff' : 'transparent',
              color: activeTab === tab.id ? '#2563eb' : '#64748b',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: activeTab === tab.id ? '700' : '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.color = '#0f172a';
              }
            }}
            onMouseOut={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#64748b';
              }
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ background: '#ffffff', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', padding: '2rem', minHeight: '600px' }}>
        {activeTab === 'overview' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Dashboard Overview</h2>
            <p style={{ color: '#64748b' }}>Fee statistics and charts will appear here.</p>
          </div>
        )}

        {activeTab === 'engine' && <FeeGenerationEngine />}

        {activeTab === 'ledgers' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Student Ledgers</h2>
            <p style={{ color: '#64748b' }}>Search and view individual student financial history.</p>
          </div>
        )}

        {activeTab === 'reconciliation' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Bank & Reconciliation</h2>
            <p style={{ color: '#64748b' }}>Approve offline payments and import bank statements.</p>
          </div>
        )}

        {activeTab === 'reports' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Financial Reports</h2>
            <p style={{ color: '#64748b' }}>Exportable aging, collection, and defaulter reports.</p>
          </div>
        )}

        {activeTab === 'configurator' && <FeeConfigurator />}
      </div>
    </div>
  );
};

export default FeesDashboard;
