import React, { useState } from 'react';
import { Book, Users, Repeat, Settings, FileText, BarChart, Shield } from 'lucide-react';
import CirculationDesk from './Library/CirculationDesk';
import CatalogManager from './Library/CatalogManager';
import LibraryMembers from './Library/LibraryMembers';
import LibraryReports from './Library/LibraryReports';
import LibrarySettings from './Library/LibrarySettings';
import LibraryOverview from './Library/LibraryOverview';
import { useAuth } from '../context/AuthContext';

const LibraryDashboard = () => {
  const [activeTab, setActiveTab] = useState('circulation');
  const { profile } = useAuth();

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart size={18} /> },
    { id: 'circulation', label: 'Circulation Desk', icon: <Repeat size={18} /> },
    { id: 'catalog', label: 'Catalog Manager', icon: <Book size={18} /> },
    { id: 'members', label: 'Members & Fines', icon: <Users size={18} /> },
    { id: 'reports', label: 'Reports & Audits', icon: <FileText size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  ];

  if (!profile || (profile.role !== 'admin' && profile.role !== 'librarian' && profile.role !== 'principal')) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <Shield size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
        <h2>Access Denied</h2>
        <p>You do not have permission to access the Library Management System.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.025em', marginBottom: '0.5rem' }}>Library Management System</h1>
        <p style={{ color: '#64748b', fontSize: '1.05rem' }}>Manage circulation, cataloging, inventory, and library members.</p>
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
        {activeTab === 'overview' && <LibraryOverview />}
        {activeTab === 'circulation' && <CirculationDesk />}
        {activeTab === 'catalog' && <CatalogManager />}
        {activeTab === 'members' && <LibraryMembers />}
        {activeTab === 'reports' && <LibraryReports />}
        {activeTab === 'settings' && <LibrarySettings />}
      </div>
    </div>
  );
};

export default LibraryDashboard;
